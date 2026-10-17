import { randomUUID, createHmac } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { validRoomId } from './database.mjs';
export function classroomIceConfig(id, env = process.env) {
  const iceServers = [];
  const stun = (env.STUN_URLS || '').split(',').map(s=>s.trim()).filter(s=>/^stuns?:/.test(s));
  if (stun.length) iceServers.push({ urls:stun });
  const turn = (env.TURN_URLS || '').split(',').map(s=>s.trim()).filter(s=>/^turns?:/.test(s));
  if (turn.length && env.TURN_SHARED_SECRET) {
    const username = `${Math.floor(Date.now()/1000)+43200}:${id}`;
    iceServers.push({urls:turn,username,credential:createHmac('sha1',env.TURN_SHARED_SECRET).update(username).digest('base64')});
  }
  return {iceServers,relayConfigured:iceServers.some(s=>s.credential)};
}
export function attachClassroomServer(server, {store,origins=[],maxParticipants=8,iceConfig=classroomIceConfig}={}) {
  const rooms = new Map(); const sockets = new WebSocketServer({noServer:true,maxPayload:64*1024});
  const limit = Math.max(2,Math.min(12,Number(maxParticipants)||8));
  const send = (socket,data) => { if (socket.readyState===1) { if (socket.bufferedAmount>1024*1024) socket.close(1013,'Connection too slow'); else socket.send(JSON.stringify(data)); } };
  const broadcast = (room,data,except) => { for (const client of room.values()) if (client.id!==except) send(client.socket,data); };
  server.on('upgrade',async(request,socket,head)=>{
    const url=new URL(request.url,'http://localhost'); if (!url.pathname.startsWith('/classroom/')) return;
    const roomId=url.pathname.slice('/classroom/'.length);
    if (!validRoomId(roomId) || origins.length && !origins.includes(request.headers.origin)) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    try { if (!await store.load(roomId)) { socket.end('HTTP/1.1 404 Not Found\r\n\r\n'); return; } } catch { socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n'); return; }
    if (socket.destroyed) return;
    sockets.handleUpgrade(request,socket,head,ws=>{
      const id=randomUUID(); let joined=false, alive=true, windowStart=Date.now(), count=0;
      const deadline=setTimeout(()=>ws.close(1008,'Join timeout'),10000);
      ws.on('pong',()=>{alive=true;});
      const heartbeat=setInterval(()=>{if(!alive){ws.terminate();return;} alive=false;ws.ping();},30000);
      ws.on('message',raw=>{
        if(Date.now()-windowStart>1000){windowStart=Date.now();count=0;} if(++count>120){ws.close(1008,'Too many messages');return;}
        let message;try{message=JSON.parse(raw.toString());}catch{ws.close(1008,'Invalid message');return;}
        if(!message || typeof message!=='object')return;
        if(!joined){
          if(message.type!=='join'||typeof message.name!=='string'||!message.name.trim()||message.name.length>40){ws.close(1008,'Enter a display name');return;}
          const room=rooms.get(roomId)||new Map(); if(room.size>=limit){send(ws,{type:'error',message:`This peer-to-peer call is full (${limit} people).`});ws.close(1008,'Call full');return;}
          const peer={id,name:message.name.trim(),media:{mic:false,camera:false,screen:false},socket:ws};
          send(ws,{type:'welcome',id,peers:[...room.values()].map(({id,name,media})=>({id,name,media})),maxParticipants:limit,...iceConfig(id)});
          room.set(id,peer);rooms.set(roomId,room);joined=true;clearTimeout(deadline);
          broadcast(room,{type:'joined',peer:{id,name:peer.name,media:peer.media}},id);return;
        }
        const room=rooms.get(roomId);if(!room)return;
        if(message.type==='signal' && typeof message.to==='string'){
          const target=room.get(message.to);if(!target||message.to===id)return;
          if(message.description && ['offer','answer'].includes(message.description.type)&&typeof message.description.sdp==='string'&&message.description.sdp.length<=48000)send(target.socket,{type:'signal',from:id,description:{type:message.description.type,sdp:message.description.sdp}});
          else if(message.candidate && typeof message.candidate.candidate==='string' && message.candidate.candidate.length<=4096)send(target.socket,{type:'signal',from:id,candidate:message.candidate});
        }else if(message.type==='media'){
          const media={mic:message.mic===true,camera:message.camera===true,screen:message.screen===true};room.get(id).media=media;broadcast(room,{type:'media',id,media},id);
        }else if(message.type==='chat'&&typeof message.text==='string'&&message.text.trim()&&message.text.length<=2000){broadcast(room,{type:'chat',id,name:room.get(id).name,text:message.text.trim(),at:Date.now()});}
      });
      ws.on('error',()=>{});
      ws.on('close',()=>{clearTimeout(deadline);clearInterval(heartbeat);const room=rooms.get(roomId);if(joined&&room){room.delete(id);broadcast(room,{type:'left',id});if(!room.size)rooms.delete(roomId);}});
    });
  });
  return {close:()=>{for(const socket of sockets.clients)socket.terminate();sockets.close();}};
}
