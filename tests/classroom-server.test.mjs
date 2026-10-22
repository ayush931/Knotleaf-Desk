import {test,expect} from 'bun:test';
import http from 'node:http';import {createHmac} from 'node:crypto';import WebSocket from 'ws';
import {attachClassroomServer,classroomIceConfig} from '../server/classroom.mjs';
const wait=async fn=>{const until=Date.now()+5000;while(!fn()){if(Date.now()>until)throw new Error('Signal timed out');await new Promise(r=>setTimeout(r,10));}};
test('room signaling routes three peers, isolates rooms, binds identity, enforces capacity and removes leavers',async()=>{
 const room=crypto.randomUUID(),other=crypto.randomUUID();const server=http.createServer();const call=attachClassroomServer(server,{store:{load:async id=>[room,other].includes(id)?{state:null}:null},iceConfig:id=>classroomIceConfig(id,{}),maxParticipants:3,origins:['https://desk.example']});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const clients=[];
 const join=async(roomId,name)=>{const socket=new WebSocket(`ws://127.0.0.1:${server.address().port}/classroom/${roomId}`,undefined,{headers:{Origin:'https://desk.example'}});clients.push(socket);const messages=[];socket.on('message',raw=>messages.push(JSON.parse(raw)));await new Promise((r,j)=>{socket.on('open',r);socket.on('error',j);});socket.send(JSON.stringify({type:'join',name}));await wait(()=>messages.some(m=>m.type==='welcome'||m.type==='error'));return{socket,messages,welcome:messages.find(m=>m.type==='welcome')};};
 try{
 const a=await join(room,'Teacher'),b=await join(room,'Student'),c=await join(room,'Student 2'),d=await join(other,'Another room');
 expect(c.welcome.peers).toHaveLength(2);expect(a.welcome.iceServers).toEqual([]);
 a.socket.send(JSON.stringify({type:'signal',to:b.welcome.id,from:'spoofed',description:{type:'offer',sdp:'v=0\r\n'}}));await wait(()=>b.messages.some(m=>m.type==='signal'));expect(b.messages.find(m=>m.type==='signal').from).toBe(a.welcome.id);expect(c.messages.some(m=>m.type==='signal')).toBe(false);
 a.socket.send(JSON.stringify({type:'signal',to:d.welcome.id,description:{type:'offer',sdp:'secret'}}));a.socket.send(JSON.stringify({type:'chat',text:'Hello class'}));await wait(()=>c.messages.some(m=>m.type==='chat'));expect(d.messages.some(m=>m.type==='chat'||m.type==='signal')).toBe(false);
 const full=await join(room,'One too many');expect(full.messages.find(m=>m.type==='error').message).toContain('full');
 b.socket.close();await wait(()=>a.messages.some(m=>m.type==='left'&&m.id===b.welcome.id));
 a.socket.send(JSON.stringify({type:'media',mic:true,camera:false,screen:true,id:d.welcome.id}));await wait(()=>c.messages.some(m=>m.type==='media'));expect(c.messages.find(m=>m.type==='media').id).toBe(a.welcome.id);
 }finally{for(const socket of clients)socket.terminate();call.close();await new Promise(r=>server.close(r));}
});
test('TURN credentials are time-limited and never expose the shared relay secret',()=>{
 const config=classroomIceConfig('student',{STUN_URLS:'stun:relay.example:3478',TURN_URLS:'turn:relay.example:3478?transport=udp',TURN_SHARED_SECRET:'server-secret'});
 expect(config.relayConfigured).toBe(true);const relay=config.iceServers[1];expect(relay.credential).toBe(createHmac('sha1','server-secret').update(relay.username).digest('base64'));expect(JSON.stringify(config)).not.toContain('server-secret');expect(Number(relay.username.split(':')[0])).toBeGreaterThan(Date.now()/1000);
});

test('creator host access and co-host moderation are verified by the server and isolated from invite holders',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path');
 const {createRoomStore}=await import('../server/database.mjs'),{createStoredRoom}=await import('../server/room-http.mjs');
 const directory=await mkdtemp(path.join(os.tmpdir(),'knotleaf-moderation-')),store=createRoomStore(null,directory),server=http.createServer(),call=attachClassroomServer(server,{store,maxParticipants:6,origins:['https://desk.example']});await new Promise(r=>server.listen(0,'127.0.0.1',r));const clients=[];
 const join=async(room,name,extra={})=>{const socket=new WebSocket(`ws://127.0.0.1:${server.address().port}/classroom/${room}`,undefined,{headers:{Origin:'https://desk.example'}}),messages=[];clients.push(socket);socket.on('message',raw=>messages.push(JSON.parse(raw)));await new Promise((r,j)=>{socket.on('open',r);socket.on('error',j);});socket.send(JSON.stringify({type:'join',name,...extra}));await wait(()=>messages.some(message=>message.type==='welcome'));return{socket,messages,welcome:messages.find(message=>message.type==='welcome')};};
 const send=(client,action,target)=>client.socket.send(JSON.stringify({type:'moderate',action,target}));
 try{
  const room=await createStoredRoom(store,{title:'Moderation',elements:[],markdownNotes:''},'https://desk.example'),other=await createStoredRoom(store,{title:'Other',elements:[],markdownNotes:''},'https://desk.example');
  const guest=await join(room.id,'Guest',{role:'host'}),host=await join(room.id,'Creator',{hostToken:room.hostToken}),co=await join(room.id,'Co-host'),another=await join(room.id,'Another'),outsider=await join(other.id,'Wrong room',{hostToken:room.hostToken});
  expect(guest.welcome.role).toBe('participant');expect(host.welcome.role).toBe('host');expect(outsider.welcome.role).toBe('participant');
  send(guest,'promote',guest.welcome.id);await wait(()=>guest.messages.some(m=>m.type==='error'));expect(co.messages.some(m=>m.type==='role')).toBe(false);
  send(host,'promote',co.welcome.id);await wait(()=>co.messages.some(m=>m.type==='role'&&m.role==='cohost'));
  send(co,'promote',another.welcome.id);await wait(()=>co.messages.some(m=>m.type==='error'&&m.message.includes('Only the host')));
  send(co,'mute',host.welcome.id);await wait(()=>co.messages.some(m=>m.type==='error'&&m.message.includes('cannot manage')));expect(host.messages.some(m=>m.type==='moderation')).toBe(false);
  another.socket.send(JSON.stringify({type:'media',mic:true}));send(co,'mute',another.welcome.id);await wait(()=>another.messages.some(m=>m.type==='moderation'&&m.action==='mute'));expect(outsider.messages.some(m=>m.type==='moderation')).toBe(false);
  send(host,'demote',co.welcome.id);await wait(()=>co.messages.some(m=>m.type==='role'&&m.role==='participant'));const before=co.messages.filter(m=>m.type==='error').length;send(co,'mute',guest.welcome.id);await wait(()=>co.messages.filter(m=>m.type==='error').length>before);
  send(host,'remove',guest.welcome.id);await wait(()=>host.messages.some(m=>m.type==='left'&&m.id===guest.welcome.id));expect(guest.messages.some(m=>m.type==='moderation'&&m.action==='remove')).toBe(true);
  expect(JSON.stringify(co.messages)).not.toContain(room.hostToken);
 }finally{for(const client of clients)client.terminate();call.close();await new Promise(r=>server.close(r));await store.close();await rm(directory,{recursive:true,force:true});}
});
