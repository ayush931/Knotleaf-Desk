import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { WebSocketServer } from "ws";
import { validRoomId } from "./database.mjs";
export function classroomIceConfig(id, env = process.env) {
  const iceServers = [];
  const stun = (env.STUN_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^stuns?:/.test(s));
  if (stun.length) iceServers.push({ urls: stun });
  const turn = (env.TURN_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^turns?:/.test(s));
  if (turn.length && env.TURN_SHARED_SECRET) {
    const username = `${Math.floor(Date.now() / 1000) + 43200}:${id}`;
    iceServers.push({
      urls: turn,
      username,
      credential: createHmac("sha1", env.TURN_SHARED_SECRET)
        .update(username)
        .digest("base64"),
    });
  }
  return { iceServers, relayConfigured: iceServers.some((s) => s.credential) };
}
export function attachClassroomServer(
  server,
  {
    store,
    origins = [],
    maxParticipants = 8,
    iceConfig = classroomIceConfig,
    reconnectGraceMs = 120000,
  } = {},
) {
  const rooms = new Map();
  const revoked=new Map();
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1024,
  });
  const limit = Math.max(2, Math.min(12, Number(maxParticipants) || 8));
  const send = (socket, data) => {
    if (socket.readyState === 1) {
      if (socket.bufferedAmount > 1024 * 1024)
        socket.close(1013, "Connection too slow");
      else socket.send(JSON.stringify(data));
    }
  };
  const broadcast = (room, data, except) => {
    for (const client of room.values())
      if (client.id !== except) send(client.socket, data);
  };
  server.on("upgrade", async (request, socket, head) => {
    const url = new URL(request.url, "http://localhost");
    if (!url.pathname.startsWith("/classroom/")) return;
    const roomId = url.pathname.slice("/classroom/".length);
    if (
      !validRoomId(roomId) ||
      (origins.length && !origins.includes(request.headers.origin))
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    let stored;
    try {
      stored = await store.load(roomId);
      if (!stored) {
        socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
        return;
      }
    } catch {
      socket.end("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      return;
    }
    if (socket.destroyed) return;
    sockets.handleUpgrade(request, socket, head, (ws) => {
      let id = randomUUID();
      let joined = false,
        joining = false,
        alive = true,
        windowStart = Date.now(),
        count = 0;
      const deadline = setTimeout(() => ws.close(1008, "Join timeout"), 10000);
      const expires = stored.expiresAt
        ? new Date(stored.expiresAt).getTime()
        : NaN;
      const expiryTimer = Number.isFinite(expires)
        ? setTimeout(
            () => {
              ws.removeAllListeners("message");
              ws.close(4001, "Room expired after 24 hours");
            },
            Math.max(0, expires - Date.now()),
          )
        : undefined;
      ws.on("pong", () => {
        alive = true;
      });
      const heartbeat = setInterval(() => {
        if (!alive) {
          ws.terminate();
          return;
        }
        alive = false;
        ws.ping();
      }, 30000);
      ws.on("message", async (raw) => {
        if (Date.now() - windowStart > 1000) {
          windowStart = Date.now();
          count = 0;
        }
        if (++count > 120) {
          ws.close(1008, "Too many messages");
          return;
        }
        let message;
        try {
          message = JSON.parse(raw.toString());
        } catch {
          ws.close(1008, "Invalid message");
          return;
        }
        if (!message || typeof message !== "object") return;
        if (!joined) {
          if (joining) return;
          if (
            message.type !== "join" ||
            typeof message.name !== "string" ||
            !message.name.trim() ||
            message.name.length > 40
          ) {
            ws.close(1008, "Enter a display name");
            return;
          }
          joining = true;
          let host = false;
          try {
            if (typeof message.hostToken === "string")
              host =
                (await store.verifyHost?.(roomId, message.hostToken)) === true;
          } catch {
            send(ws, {
              type: "error",
              message: "Could not verify host access. Retry shortly.",
            });
            ws.close(1013, "Host verification unavailable");
            return;
          } finally {
            joining = false;
          }
          if (ws.readyState !== 1) return;
          const room = rooms.get(roomId) || new Map();
          const resumed=typeof message.resumeToken==='string'&&message.resumeToken.length===43?[...room.values()].find(peer=>peer.resumeToken===message.resumeToken):undefined;
          for(const [token,record]of revoked)if(record.expiresAt<=Date.now())revoked.delete(token);
          if(revoked.get(message.resumeToken)?.roomId===roomId){ws.close(4003,'Removed by host');return;}
          const hasOwner = stored.hasHost || !!stored.hostTokenHash;
          const reserveHost =
            hasOwner &&
            !host &&
            ![...room.values()].some((peer) => peer.role === "host");
          if (!resumed&&(room.size >= limit || (reserveHost && room.size >= limit - 1))) {
            send(ws, {
              type: "error",
              message: `This peer-to-peer call is full (${limit} people; a place is reserved for the host).`,
            });
            ws.close(1008, "Call full");
            return;
          }
          const role = resumed?.role || (host ? "host" : "participant");
          if(resumed){id=resumed.id;clearTimeout(resumed.disconnectTimer);resumed.socket.close(4004,'Session resumed');}
          const peer = resumed || {
            id,
            name: message.name.trim(),
            role,
            media: { mic: false, camera: false, screen: false },
            socket: ws,
            resumeToken:message.resume===true?randomBytes(32).toString('base64url'):undefined,
          };
          peer.socket=ws;peer.disconnectTimer=undefined;
          send(ws, {
            type: "welcome",
            resumeToken:peer.resumeToken,
            muted:peer.muted===true,
            id,
            role,
            peers: [...room.values()].filter(peer=>peer.id!==id).map(({ id, name, media, role }) => ({
              id,
              name,
              media,
              role,
            })),
            maxParticipants: limit,
            ...iceConfig(id),
          });
          room.set(id, peer);
          rooms.set(roomId, room);
          joined = true;
          clearTimeout(deadline);
          if(!resumed)broadcast(
            room,
            {
              type: "joined",
              peer: { id, name: peer.name, role, media: peer.media },
            },
            id,
          );
          return;
        }
        const room = rooms.get(roomId);
        if (!room?.has(id)||room.get(id).socket!==ws) return;
        if(message.type==='leave'){room.get(id).resumeToken=undefined;ws.close(1000,'Left call');return;}
        if (message.type === "moderate") {
          const actor = room.get(id),
            action = message.action;
          if (!actor || !["host", "cohost"].includes(actor.role)) {
            send(ws, {
              type: "error",
              message: "Host or co-host access is required.",
            });
            return;
          }
          const canManage = (target) =>
            target &&
            target.id !== id &&
            target.role !== "host" &&
            (actor.role === "host" || target.role === "participant");
          const mute = (target) => {
            target.media = { ...target.media, mic: false };
            target.muted=true;
            send(target.socket, {
              type: "moderation",
              action: "mute",
              by: actor.name,
            });
            broadcast(room, {
              type: "media",
              id: target.id,
              media: target.media,
            });
          };
          if (action === "mute-all") {
            for (const target of room.values())
              if (canManage(target)) mute(target);
            return;
          }
          const target = room.get(message.target);
          if (!canManage(target)) {
            send(ws, {
              type: "error",
              message: "You cannot manage this participant.",
            });
            return;
          }
          if (action === "promote" || action === "demote") {
            if (actor.role !== "host") {
              send(ws, {
                type: "error",
                message: "Only the host can change co-host roles.",
              });
              return;
            }
            target.role = action === "promote" ? "cohost" : "participant";
            broadcast(room, { type: "role", id: target.id, role: target.role });
          } else if (action === "mute") mute(target);
          else if (action === "remove") {
            if(target.resumeToken)revoked.set(target.resumeToken,{roomId,expiresAt:Number.isFinite(expires)?expires:Date.now()+86400000});
            clearTimeout(target.disconnectTimer);
            room.delete(target.id);
            send(target.socket, {
              type: "moderation",
              action: "remove",
              by: actor.name,
            });
            target.socket.close(4003, "Removed by host");
            broadcast(room, { type: "left", id: target.id });
          }
          return;
        }
        if (message.type === "signal" && typeof message.to === "string") {
          const target = room.get(message.to);
          if (!target || message.to === id) return;
          if (
            message.description &&
            ["offer", "answer"].includes(message.description.type) &&
            typeof message.description.sdp === "string" &&
            message.description.sdp.length <= 48000
          )
            send(target.socket, {
              type: "signal",
              from: id,
              description: {
                type: message.description.type,
                sdp: message.description.sdp,
              },
            });
          else if (
            message.candidate &&
            typeof message.candidate.candidate === "string" &&
            message.candidate.candidate.length <= 4096
          )
            send(target.socket, {
              type: "signal",
              from: id,
              candidate: message.candidate,
            });
        } else if (message.type === "media") {
          const media = {
            mic: message.mic === true,
            camera: message.camera === true,
            screen: message.screen === true,
          };
          room.get(id).media = media;
          if(media.mic)room.get(id).muted=false;
          broadcast(room, { type: "media", id, media }, id);
        } else if (
          message.type === "chat" &&
          typeof message.text === "string" &&
          message.text.trim() &&
          message.text.length <= 2000
        ) {
          broadcast(room, {
            type: "chat",
            id,
            name: room.get(id).name,
            text: message.text.trim(),
            at: Date.now(),
          });
        }
      });
      ws.on("error", () => {});
      ws.on("close", (code) => {
        clearTimeout(deadline);
        clearTimeout(expiryTimer);
        clearInterval(heartbeat);
        const room = rooms.get(roomId);
        if (joined && room?.has(id)&&room.get(id).socket===ws) {
          const peer=room.get(id);
          const remove=()=>{if(room.get(id)!==peer||peer.socket!==ws)return;room.delete(id);broadcast(room,{type:'left',id});if(!room.size)rooms.delete(roomId);};
          if(peer.resumeToken&&![1000,1008,4001,4003,4004].includes(code)){
            peer.disconnectTimer=setTimeout(remove,reconnectGraceMs);peer.disconnectTimer.unref?.();
          }else remove();
        }
      });
    });
  });
  return {
    expireRoom: (id) => {
      for(const [token,record]of revoked)if(record.roomId===id)revoked.delete(token);
      for (const peer of rooms.get(id)?.values() || []) {
        clearTimeout(peer.disconnectTimer);
        peer.socket.removeAllListeners("message");
        peer.socket.close(4001, "Room expired after 24 hours");
      }
      rooms.delete(id);
    },
    close: () => {
      for(const room of rooms.values())for(const peer of room.values())clearTimeout(peer.disconnectTimer);
      rooms.clear();revoked.clear();
      for (const socket of sockets.clients) socket.terminate();
      sockets.close();
    },
  };
}
