import {test,expect} from 'bun:test';
import {ClassroomSession,classroomSocketUrl} from '../lib/classroom.ts';
const until=async fn=>{const deadline=Date.now()+2000;while(!fn()){if(Date.now()>deadline)throw new Error('Client timed out');await new Promise(r=>setTimeout(r,5));}};
async function mocked(action){
 const saved=new Map(),sockets=[],pcs=[],tracks=[];
 class Stream{constructor(list=[]){this.tracks=[...list];}getTracks(){return this.tracks;}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}addTrack(t){this.tracks.push(t);}removeTrack(t){this.tracks=this.tracks.filter(x=>x!==t);}}
 const track=kind=>{const t={kind,label:kind==='audio'?'USB microphone':'Camera',id:crypto.randomUUID(),stopped:false,stop(){this.stopped=true;}};tracks.push(t);return t;};
 class Socket{readyState=1;sent=[];constructor(){sockets.push(this);}send(raw){this.sent.push(JSON.parse(raw));}receive(message){this.onmessage?.({data:JSON.stringify(message)});}close(){this.readyState=3;this.onclose?.();}}
 class PC{connectionState='new';signalingState='stable';transceivers=[];candidates=[];constructor(){pcs.push(this);}addTransceiver(source){const kind=typeof source==='string'?source:source.kind;const slot={kind,sender:{track:typeof source==='string'?null:source,async replaceTrack(t){this.track=t;}}};this.transceivers.push(slot);return slot;}getTransceivers(){return this.transceivers;}async setLocalDescription(){const type=this.remoteDescription?.type==='offer'?'answer':'offer';this.localDescription={type,sdp:'v=0',toJSON(){return {type:this.type,sdp:this.sdp};}};this.signalingState=type==='offer'?'have-local-offer':'stable';}async setRemoteDescription(d){this.remoteDescription=d;this.signalingState=d.type==='offer'?'have-remote-offer':'stable';}async addIceCandidate(c){this.candidates.push(c);}restartIce(){this.restarted=true;}close(){this.connectionState='closed';}}
 const values={WebSocket:Socket,RTCPeerConnection:PC,MediaStream:Stream,navigator:{mediaDevices:{getUserMedia:async options=>new Stream([track(options.audio?'audio':'video')]),getDisplayMedia:async()=>new Stream([track('video'),track('audio')])}}};
 for(const [key,value]of Object.entries(values)){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 try{await action({sockets,pcs,tracks,track});}finally{for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
}
test('native classroom uses four media slots, updates tracks and releases devices when leaving',async()=>mocked(async({sockets,pcs,tracks})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Teacher');let state;session.onState=next=>{state=next;};
 const socket=sockets[0];socket.onopen();expect(socket.sent[0]).toEqual({type:'join',name:'Teacher'});
 socket.receive({type:'welcome',id:'a',peers:[{id:'b',name:'Student',media:{mic:false,camera:false,screen:false}}],iceServers:[],maxParticipants:8});expect(pcs[0].transceivers.map(t=>t.kind)).toEqual(['audio','video','video','audio']);
 await session.toggle('mic');await session.toggle('camera');await session.toggleScreen(false,true);expect(state.media).toEqual({mic:true,camera:true,screen:true});expect(pcs[0].transceivers.every(t=>t.sender.track)).toBe(true);
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

test('answerer adopts offered slots and sends an already shared screen into the negotiated screen slot',async()=>mocked(async({sockets,pcs})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Guest');let state;session.onState=next=>state=next;
 sockets[0].receive({type:'welcome',id:'z',peers:[{id:'a',name:'Host',media:{mic:false,camera:false,screen:false}}],iceServers:[],maxParticipants:8});
 expect(pcs[0].transceivers).toHaveLength(0);
 await session.toggleScreen();const screen=state.screen.getVideoTracks()[0];
 // The real browser creates these while applying the remote offer, not locally.
 const remote=pcs[0].setRemoteDescription.bind(pcs[0]);pcs[0].setRemoteDescription=async description=>{await remote(description);['audio','video','video','audio'].forEach(kind=>pcs[0].addTransceiver(kind));};
 sockets[0].receive({type:'signal',from:'a',description:{type:'offer',sdp:'four offered slots'}});
 await until(()=>sockets[0].sent.some(message=>message.description?.type==='answer'));
 expect(pcs[0].transceivers).toHaveLength(4);expect(pcs[0].transceivers[2].sender.track).toBe(screen);
 const incoming={kind:'video',id:'remote-screen'};pcs[0].ontrack({track:incoming,transceiver:pcs[0].transceivers[2]});
 expect(state.peers[0].screen.getVideoTracks()).toEqual([incoming]);expect(state.peers[0].camera.getVideoTracks()).toHaveLength(0);session.close();
}));
test('changing screen preserves capture on cancel, replaces both slots, and ignores an old ended event',async()=>mocked(async({sockets,pcs,tracks})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Host');let state;session.onState=next=>state=next;
 sockets[0].receive({type:'welcome',id:'a',peers:[{id:'z',name:'Guest',media:{mic:false,camera:false,screen:false}}],iceServers:[],maxParticipants:8});
 await session.toggleScreen();const previous=state.screen,oldVideo=previous.getVideoTracks()[0],capture=navigator.mediaDevices.getDisplayMedia;
 navigator.mediaDevices.getDisplayMedia=async()=>{throw new DOMException('Cancelled','NotAllowedError');};
 await expect(session.toggleScreen(true)).rejects.toThrow('Cancelled');expect(state.screen).toBe(previous);expect(oldVideo.stopped).toBe(false);
 navigator.mediaDevices.getDisplayMedia=capture;await session.toggleScreen(true);expect(oldVideo.stopped).toBe(true);
 const next=state.screen;oldVideo.onended();expect(state.screen).toBe(next);expect(state.media.screen).toBe(true);expect(pcs[0].transceivers[2].sender.track).toBe(next.getVideoTracks()[0]);
 next.getVideoTracks()[0].onended();await until(()=>!state.media.screen);expect(pcs[0].transceivers[2].sender.track).toBe(null);session.close();expect(tracks.every(track=>track.stopped)).toBe(true);
}));

test('microphones request native echo/noise processing and changing noise settings retains the live device',async()=>mocked(async({sockets,tracks})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Host');let state;session.onState=next=>state=next;sockets[0].receive({type:'welcome',id:'a',peers:[],iceServers:[],maxParticipants:8});
 const capture=navigator.mediaDevices.getUserMedia,requests=[];navigator.mediaDevices.getUserMedia=async options=>{requests.push(options);return capture(options);};
 await session.toggle('mic');expect(requests[0].audio).toMatchObject({echoCancellation:true,noiseSuppression:true,autoGainControl:true});
 const microphone=tracks[0];let applied;microphone.applyConstraints=async constraints=>{applied=constraints;};microphone.getSettings=()=>({echoCancellation:true,noiseSuppression:applied?.noiseSuppression??true});
 await session.setNoiseSuppression(false);expect(applied).toMatchObject({echoCancellation:true,noiseSuppression:false,autoGainControl:true});expect(state.noiseSuppression).toBe(false);expect(state.audioProcessing).toEqual({echoCancellation:true,noiseSuppression:false});expect(microphone.stopped).toBe(false);expect(requests).toHaveLength(1);
 microphone.applyConstraints=async()=>{throw new Error('Unavailable');};await expect(session.setNoiseSuppression(true)).rejects.toThrow('Unavailable');expect(state.noiseSuppression).toBe(false);expect(microphone.stopped).toBe(false);
 session.close();
}));
test('screen audio is opt-in and system/window audio cannot feed call playback back to peers',async()=>mocked(async({sockets,pcs,tracks})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Host');let state;session.onState=next=>state=next;sockets[0].receive({type:'welcome',id:'a',peers:[{id:'z',name:'Peer',media:{mic:false,camera:false,screen:false}}],iceServers:[],maxParticipants:8});
 const capture=navigator.mediaDevices.getDisplayMedia,requests=[];navigator.mediaDevices.getSupportedConstraints=()=>({restrictOwnAudio:true,suppressLocalAudioPlayback:true});
 navigator.mediaDevices.getDisplayMedia=async options=>{requests.push(options);return capture(options);};
 await session.toggleScreen();expect(requests[0].audio).toBe(false);expect(requests[0].selfBrowserSurface).toBe('exclude');expect(requests[0].systemAudio).toBe('exclude');expect(state.screen.getAudioTracks()).toHaveLength(0);expect(pcs[0].transceivers[3].sender.track).toBe(null);expect(tracks[1].stopped).toBe(true);
 await session.toggleScreen(true,true);expect(requests[1].audio).toMatchObject({echoCancellation:true,restrictOwnAudio:true,suppressLocalAudioPlayback:true});expect(state.screen.getAudioTracks()).toHaveLength(1);
 navigator.mediaDevices.getDisplayMedia=async options=>{const stream=await capture(options);stream.getVideoTracks()[0].getSettings=()=>({displaySurface:'monitor'});return stream;};
 await session.toggleScreen(true,true);expect(state.screen.getAudioTracks()).toHaveLength(0);expect(pcs[0].transceivers[3].sender.track).toBe(null);session.close();expect(tracks.every(track=>track.stopped)).toBe(true);
}));
test('changing noise cancellation while muted never enables the microphone',async()=>mocked(async({sockets,tracks})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Host');let state;session.onState=next=>state=next;sockets[0].receive({type:'welcome',id:'a',peers:[],iceServers:[],maxParticipants:8});await session.setNoiseSuppression(false);expect(state.media.mic).toBe(false);expect(state.noiseSuppression).toBe(false);expect(tracks).toHaveLength(0);session.close();
}));

test('host roles follow server acknowledgments and host muting wins over an in-flight microphone switch',async()=>mocked(async({sockets,tracks,track})=>{
 const secret='a'.repeat(64),session=new ClassroomSession('ws://localhost/classroom/room','Host',{hostToken:secret});let state;session.onState=next=>state=next;const socket=sockets[0];socket.onopen();expect(socket.sent[0].hostToken).toBe(secret);
 socket.receive({type:'welcome',id:'a',role:'host',peers:[],iceServers:[],maxParticipants:8});expect(state.role).toBe('host');expect(JSON.stringify(state)).not.toContain(secret);await session.toggle('mic');
 let finish;navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>finish=resolve);const switching=session.selectMicrophone('usb');socket.receive({type:'moderation',action:'mute',by:'Co-host'});await until(()=>state.media.mic===false);
 const late=track('audio');finish({getTracks:()=>[late]});await switching;expect(late.stopped).toBe(true);expect(state.media.mic).toBe(false);expect(state.microphone).toBe(null);expect(state.notice).toContain('Co-host');
 socket.receive({type:'role',id:'a',role:'cohost'});expect(state.role).toBe('cohost');session.moderate('mute-all');expect(socket.sent.at(-1).action).toBe('mute-all');session.close();expect(tracks.every(t=>t.stopped)).toBe(true);
}));

test('a browser ignoring live noise constraints replaces the microphone only after a working capture is ready',async()=>mocked(async({sockets,tracks,track})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Host');let state;session.onState=next=>state=next;sockets[0].receive({type:'welcome',id:'a',peers:[],iceServers:[],maxParticipants:8});await session.toggle('mic');
 const previous=tracks[0];previous.applyConstraints=async()=>{};previous.getSettings=()=>({echoCancellation:true,noiseSuppression:true});
 let finish;navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>finish=resolve);const changing=session.setNoiseSuppression(false);await until(()=>!!finish);expect(previous.stopped).toBe(false);
 const replacement=track('audio');replacement.getSettings=()=>({echoCancellation:true,noiseSuppression:false});finish(new MediaStream([replacement]));await changing;expect(previous.stopped).toBe(true);expect(replacement.stopped).toBe(false);expect(state.noiseSuppression).toBe(false);expect(state.audioProcessing.noiseSuppression).toBe(false);
 replacement.applyConstraints=async()=>{};navigator.mediaDevices.getUserMedia=async()=>{throw new Error('Device unavailable');};await expect(session.setNoiseSuppression(true)).rejects.toThrow('Device unavailable');expect(replacement.stopped).toBe(false);expect(state.noiseSuppression).toBe(false);session.close();
}));
test('remote mute wins over an in-flight noise processor replacement',async()=>mocked(async({sockets,tracks,track})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Host');let state;session.onState=next=>state=next;sockets[0].receive({type:'welcome',id:'a',peers:[],iceServers:[],maxParticipants:8});await session.toggle('mic');tracks[0].applyConstraints=async()=>{};tracks[0].getSettings=()=>({noiseSuppression:true});
 let finish;navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>finish=resolve);const changing=session.setNoiseSuppression(false);await until(()=>!!finish);sockets[0].receive({type:'moderation',action:'mute',by:'Host'});await until(()=>!state.media.mic);const late=track('audio');finish(new MediaStream([late]));await changing;expect(late.stopped).toBe(true);expect(state.media.mic).toBe(false);expect(state.microphone).toBe(null);session.close();
}));
test('a noise processor replacement that disables echo cancellation is rejected without interrupting the mic',async()=>mocked(async({sockets,tracks,track})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Host');let state;session.onState=next=>state=next;sockets[0].receive({type:'welcome',id:'a',peers:[],iceServers:[],maxParticipants:8});await session.toggle('mic');const previous=tracks[0];previous.applyConstraints=async()=>{};previous.getSettings=()=>({noiseSuppression:true,echoCancellation:true});
 const bad=track('audio');bad.getSettings=()=>({noiseSuppression:false,echoCancellation:false});navigator.mediaDevices.getUserMedia=async()=>new MediaStream([bad]);await expect(session.setNoiseSuppression(false)).rejects.toThrow('could not apply');expect(bad.stopped).toBe(true);expect(previous.stopped).toBe(false);expect(state.media.mic).toBe(true);expect(state.noiseSuppression).toBe(true);session.close();
}));
test('removal releases devices and exposes disconnected state before a delayed socket close handshake',async()=>mocked(async({sockets,tracks,pcs,track})=>{
 const session=new ClassroomSession('ws://localhost/classroom/room','Guest');let state;session.onState=next=>state=next;const socket=sockets[0];socket.receive({type:'welcome',id:'a',peers:[{id:'z',name:'Host',media:{mic:false,camera:false,screen:false}}],iceServers:[],maxParticipants:8});await session.toggle('mic');await session.toggle('camera');await session.toggleScreen();
 let finish;navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>finish=resolve);const switching=session.selectMicrophone('usb');let closing=false;socket.close=()=>{closing=true;};let notice='';session.onError=message=>notice=message;socket.receive({type:'moderation',action:'remove',by:'Host'});
 expect(closing).toBe(true);expect(socket.readyState).toBe(1);expect(state.status).toBe('disconnected');expect(state.media).toEqual({mic:false,camera:false,screen:false});expect(state.peers).toHaveLength(0);expect(tracks.every(t=>t.stopped)).toBe(true);expect(pcs.every(p=>p.connectionState==='closed')).toBe(true);expect(notice).toContain('removed');
 const late=track('audio');finish(new MediaStream([late]));await switching;expect(late.stopped).toBe(true);socket.onclose({code:4003});expect(state.status).toBe('disconnected');session.close();
}));
