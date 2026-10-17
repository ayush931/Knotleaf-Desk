import {test,expect} from 'bun:test';
import {ClassroomSession,classroomSocketUrl} from '../lib/classroom.ts';
const until=async fn=>{const deadline=Date.now()+2000;while(!fn()){if(Date.now()>deadline)throw new Error('Client timed out');await new Promise(r=>setTimeout(r,5));}};
async function mocked(action){
 const saved=new Map(),sockets=[],pcs=[],tracks=[];
 class Stream{constructor(list=[]){this.tracks=[...list];}getTracks(){return this.tracks;}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}addTrack(t){this.tracks.push(t);}removeTrack(t){this.tracks=this.tracks.filter(x=>x!==t);}}
 const track=kind=>{const t={kind,label:kind==='audio'?'USB microphone':'Camera',id:crypto.randomUUID(),stopped:false,stop(){this.stopped=true;}};tracks.push(t);return t;};
 class Socket{readyState=1;sent=[];constructor(){sockets.push(this);}send(raw){this.sent.push(JSON.parse(raw));}receive(message){this.onmessage?.({data:JSON.stringify(message)});}close(){this.readyState=3;this.onclose?.();}}
 class PC{connectionState='new';signalingState='stable';transceivers=[];candidates=[];constructor(){pcs.push(this);}addTransceiver(kind){const slot={kind,sender:{track:null,async replaceTrack(t){this.track=t;}}};this.transceivers.push(slot);return slot;}getTransceivers(){return this.transceivers;}async setLocalDescription(){const type=this.remoteDescription?.type==='offer'?'answer':'offer';this.localDescription={type,sdp:'v=0',toJSON(){return {type:this.type,sdp:this.sdp};}};this.signalingState=type==='offer'?'have-local-offer':'stable';}async setRemoteDescription(d){this.remoteDescription=d;this.signalingState=d.type==='offer'?'have-remote-offer':'stable';}async addIceCandidate(c){this.candidates.push(c);}restartIce(){this.restarted=true;}close(){this.connectionState='closed';}}
 const values={WebSocket:Socket,RTCPeerConnection:PC,MediaStream:Stream,navigator:{mediaDevices:{getUserMedia:async options=>new Stream([track(options.audio?'audio':'video')]),getDisplayMedia:async()=>new Stream([track('video'),track('audio')])}}};
 for(const [key,value]of Object.entries(values)){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 try{await action({sockets,pcs,tracks,track});}finally{for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
}
test('native classroom uses four media slots, updates tracks and releases devices when leaving',async()=>mocked(async({sockets,pcs,tracks})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Teacher');let state;session.onState=next=>{state=next;};
 const socket=sockets[0];socket.onopen();expect(socket.sent[0]).toEqual({type:'join',name:'Teacher'});
 socket.receive({type:'welcome',id:'a',peers:[{id:'b',name:'Student',media:{mic:false,camera:false,screen:false}}],iceServers:[],maxParticipants:8});expect(pcs[0].transceivers.map(t=>t.kind)).toEqual(['audio','video','video','audio']);
 await session.toggle('mic');await session.toggle('camera');await session.toggleScreen();expect(state.media).toEqual({mic:true,camera:true,screen:true});expect(pcs[0].transceivers.every(t=>t.sender.track)).toBe(true);
 await session.toggleScreen();expect(state.media.screen).toBe(false);expect(pcs[0].transceivers[2].sender.track).toBe(null);
 session.close();expect(tracks.every(t=>t.stopped)).toBe(true);expect(pcs[0].connectionState).toBe('closed');
}));
test('native classroom queues early ICE, handles offers and rejects impolite glare',async()=>mocked(async({sockets,pcs})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Teacher'),socket=sockets[0];
 socket.receive({type:'welcome',id:'a',peers:[{id:'b',name:'Student',media:{mic:false,camera:false,screen:false}}],iceServers:[],maxParticipants:8});
 socket.receive({type:'signal',from:'b',candidate:{candidate:'early'}});await until(()=>session.peers.get('b').candidates.length===1);expect(pcs[0].candidates).toHaveLength(0);
 socket.receive({type:'signal',from:'b',description:{type:'offer',sdp:'first'}});await until(()=>socket.sent.some(m=>m.description?.type==='answer'));expect(pcs[0].candidates[0].candidate).toBe('early');
 session.peers.get('b').makingOffer=true;socket.receive({type:'signal',from:'b',description:{type:'offer',sdp:'collision'}});await until(()=>session.peers.get('b').ignoreOffer);expect(pcs[0].remoteDescription.sdp).toBe('first');
 session.close();
}));
test('classroom endpoint follows the room host and strips unrelated paths',()=>{expect(classroomSocketUrl('wss://rooms.example/collaboration','abc')).toBe('wss://rooms.example/classroom/abc');expect(classroomSocketUrl('http://localhost:3000','abc')).toBe('ws://localhost:3000/classroom/abc');});
test('microphone selection stays muted, switches live tracks and keeps the old source on failure',async()=>mocked(async({sockets,pcs,tracks})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Teacher');let state;session.onState=next=>state=next;
 sockets[0].receive({type:'welcome',id:'a',peers:[{id:'b',name:'Student',media:{mic:false,camera:false,screen:false}}],iceServers:[],maxParticipants:8});
 const capture=navigator.mediaDevices.getUserMedia,requests=[];navigator.mediaDevices.getUserMedia=async options=>{requests.push(options);return capture(options);};
 await session.selectMicrophone('usb');expect(tracks).toHaveLength(0);expect(state.media.mic).toBe(false);
 await session.toggle('mic');expect(requests[0].audio.deviceId).toEqual({exact:'usb'});expect(state.microphoneLabel).toBe('USB microphone');const old=tracks[0];
 await session.selectMicrophone('');expect(requests[1].audio.deviceId).toBeUndefined();expect(old.stopped).toBe(true);expect(state.microphoneId).toBe('');expect(pcs[0].transceivers[0].sender.track).toBe(tracks[1]);
 navigator.mediaDevices.getUserMedia=async()=>{throw new Error('Device unplugged');};
 await expect(session.selectMicrophone('missing')).rejects.toThrow('Device unplugged');expect(tracks[1].stopped).toBe(false);expect(state.microphoneId).toBe('');expect(state.media.mic).toBe(true);
 tracks[1].onended();expect(state.media.mic).toBe(false);expect(state.microphoneLabel).toBe('');session.close();
}));
test('leaving during microphone switching releases the newly acquired device',async()=>mocked(async({sockets,tracks,track})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Teacher');sockets[0].receive({type:'welcome',id:'a',peers:[],iceServers:[],maxParticipants:8});await session.toggle('mic');
 let resolve;navigator.mediaDevices.getUserMedia=()=>new Promise(r=>resolve=r);const switching=session.selectMicrophone('usb');session.close();const late=track('audio');resolve({getTracks:()=>[late]});await switching;expect(tracks.every(t=>t.stopped)).toBe(true);
}));
