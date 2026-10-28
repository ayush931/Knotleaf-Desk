import { shortRoomCode } from "./shortRoomCode";
import { isRoomInviteId } from "./roomInvites";
const CONFIG_TTL = 30000;
let cached: { origin: string; url: string; until: number } | undefined;
let pending: { origin: string; result: Promise<string> } | undefined;
const createdRooms = new Map<string, number>();

export function rememberRoomServerUrl(endpoint: string) {
  const url = new URL(endpoint, window.location.origin);
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  if (!["ws:", "wss:"].includes(url.protocol))
    throw new Error("The room server URL is invalid.");
  cached = {
    origin: window.location.origin,
    url: url.toString().replace(/\/$/, ""),
    until: Date.now() + CONFIG_TTL,
  };
  return cached.url;
}
export function rememberCreatedRoom(id: string, expiresAt?: string) {
  const expiry = expiresAt ? Date.parse(expiresAt) : Infinity;
  createdRooms.set(
    `${window.location.origin}:${id}`,
    Math.min(Date.now() + 10000, Number.isFinite(expiry) ? expiry : Infinity),
  );
  if (createdRooms.size > 20)
    createdRooms.delete(createdRooms.keys().next().value!);
}
export function resetRoomConnectionCache() {
  cached = undefined;
  pending = undefined;
  createdRooms.clear();
}

/** Runtime configuration stays origin-scoped; concurrent joins share one short-lived lookup. */
export async function getRoomServerUrl(signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  const origin = window.location.origin;
  if (cached?.origin === origin && cached.until > Date.now()) return cached.url;
  if (!pending || pending.origin !== origin) {
    const result = (async () => {
      const response = await fetch("/api/collaboration-health", {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      const config = await response.json();
      if (
        !response.ok ||
        !config.collaboration ||
        typeof config.websocketUrl !== "string"
      ) {
        throw new Error(
          config.message ||
            "Room sharing is unavailable. Start the local server or check the hosted room server configuration.",
        );
      }
      if (window.location.origin !== origin)
        throw new Error("The website changed. Retry on the current website.");
      return rememberRoomServerUrl(config.websocketUrl);
    })();
    const lookup = { origin, result };
    pending = lookup;
    void result
      .finally(() => {
        if (pending === lookup) pending = undefined;
      })
      .catch(() => {});
  }
  const result = pending.result;
  if (!signal) return result;
  let abort: (() => void) | undefined;
  try {
    const cancelled = new Promise<never>((_resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
    });
    return await Promise.race([result, cancelled]);
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
  }
}

export function roomInviteUrl(roomId: string, classroom = false): string {
  if(isRoomInviteId(roomId))return `${window.location.origin}/${classroom?"v":"r"}/${shortRoomCode(roomId)}`;
  return `${window.location.origin}/canvas/${encodeURIComponent(roomId)}${classroom ? "?classroom=1" : ""}`;
}

export class RoomExpiredError extends Error {}
export async function checkRoomAvailable(
  serverUrl: string,
  roomId: string,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  const key = `${window.location.origin}:${roomId}`;
  if ((createdRooms.get(key) || 0) > Date.now()) return;
  createdRooms.delete(key);
  const url = new URL(serverUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = `/api/rooms/${encodeURIComponent(roomId)}`;
  url.search = "";
  const timeout = AbortSignal.timeout(60000);
  const response = await fetch(url, {
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (response.status === 404 || response.status === 410)
    throw new RoomExpiredError("This room expired or no longer exists.");
  if (!response.ok)
    throw new Error("Could not check the room server. Retry shortly.");
}
