'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { Video, X, Mic, MonitorUp, PhoneOff, Copy } from 'lucide-react';
import { ClassroomSession, classroomSocketUrl, type ClassState } from '@/lib/classroom';
import { getRoomServerUrl, roomInviteUrl } from '@/lib/roomConnection';
import { ClassroomAudioSource } from './ClassroomAudioSource';
import { LocalRecorder } from './LocalRecorder';
function MediaVideo({stream,label}:{stream:MediaStream|null;label:string}){
  const video=useRef<HTMLVideoElement>(null), tracks=stream?.getTracks().length || 0;
  useEffect(()=>{const element=video.current;if(element){element.srcObject=stream;void element.play().catch(()=>{});}return()=>{if(element)element.srcObject=null;};},[stream,tracks]);
  return <video ref={video} aria-label={label} autoPlay playsInline muted className="aspect-video w-full rounded-lg bg-neutral-950 object-contain" />;
}
function PeerAudio({stream,name}:{stream:MediaStream;name:string}){
  const audio=useRef<HTMLAudioElement>(null),[blocked,setBlocked]=useState(false),tracks=stream.getTracks().length;
  useEffect(()=>{const element=audio.current;if(!element)return;element.srcObject=stream;if(tracks)void element.play().catch(()=>setBlocked(true));return()=>{element.srcObject=null;};},[stream,tracks]);
  return <><audio ref={audio} autoPlay />{blocked&&<button className="rounded border border-neutral-700 px-2 py-1 text-xs" onClick={()=>{void audio.current?.play().then(()=>setBlocked(false)).catch(()=>{});}}>Enable sound for {name}</button>}</>;
}
export function Classroom({roomId,onCreateRoom}:{roomId?:string;onCreateRoom?:()=>Promise<void>}){
  const search=useSearchParams(),panelId=useId(),trigger=useRef<HTMLButtonElement>(null);
  const minimize=()=>{setOpen(false);requestAnimationFrame(()=>trigger.current?.focus());};
  const [open,setOpen]=useState(()=>!!roomId&&search.get('classroom')==='1'),[name,setName]=useState(''),[state,setState]=useState<ClassState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[chat,setChat]=useState('');
  const client=useRef<ClassroomSession|null>(null),input=useRef<HTMLInputElement>(null);
  const joinAbort=useRef<AbortController|null>(null);
  useEffect(()=>()=>{joinAbort.current?.abort();if(client.current){client.current.onState=undefined;client.current.onError=undefined;client.current.close();}},[]);
  useEffect(()=>{if(open&&state?.status!=='connected'){const frame=requestAnimationFrame(()=>input.current?.focus());return()=>cancelAnimationFrame(frame);}},[open,state?.status]);
  const join=async()=>{
    if(busy)return;
    if(!name.trim()){setError('Enter your name first.');input.current?.focus();return;}
    if(!roomId)return;
    if(typeof RTCPeerConnection==='undefined'||!navigator.mediaDevices){setError('Calls need a current browser over HTTPS (or localhost).');return;}
    client.current?.close();setError('');setBusy('join');
    const controller=new AbortController();joinAbort.current?.abort();joinAbort.current=controller;
    try {
      const base=await getRoomServerUrl(controller.signal);
      if(controller.signal.aborted)return;
      const session=new ClassroomSession(classroomSocketUrl(base,roomId),name.trim());client.current=session;
      session.onState=next=>{setState(next);if(next.status!=='joining')setBusy('');};session.onError=message=>{setError(message);setBusy('');};
    } catch(error) { if(controller.signal.aborted)return;setBusy('');setError(error instanceof Error?error.message:'Could not connect to the call server. Retry.'); }
  };
  const leave=()=>{joinAbort.current?.abort();if(client.current){client.current.onState=undefined;client.current.onError=undefined;client.current.close();client.current=null;}setState(null);setBusy('');setError('');};
  const act=async(action:string)=>{if(busy)return;setBusy(action);setError('');try{if(action==='screen')await client.current?.toggleScreen();else await client.current?.toggle(action as 'mic'|'camera');}catch(error){setError(error instanceof Error?error.message:'Media could not start. Check browser permissions and retry.');}finally{setBusy('');}};
  const createRoom=async()=>{if(!onCreateRoom||busy)return;setBusy('create');setError('');try{await onCreateRoom();}catch(error){setError(error instanceof Error?error.message:'Could not create a room. Retry from Share.');}finally{setBusy('');}};
  useEffect(()=>{if(!open)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented){setOpen(false);trigger.current?.focus();}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[open]);
  const [copyStatus,setCopyStatus]=useState({link:'',message:''}),inviteInput=useRef<HTMLInputElement>(null);
  const inviteLink=roomId&&typeof window!=='undefined'?roomInviteUrl(roomId,true):'';
  const copyInvite=async()=>{try{await navigator.clipboard.writeText(inviteLink);setCopyStatus({link:inviteLink,message:'Invite link copied'});}catch{inviteInput.current?.focus();inviteInput.current?.select();setCopyStatus({link:inviteLink,message:'Select and copy the link above.'});}};
  const selectMicrophone=async(id:string)=>{if(busy)return;setBusy('source');setError('');try{await client.current?.selectMicrophone(id);}catch(error){setError(error instanceof Error?error.message:'Could not switch microphone. Your current source is unchanged.');}finally{setBusy('');}};
  const connected=state?.status==='connected';
  const control='flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2 text-xs hover:bg-neutral-800 disabled:opacity-40';
  return <><button ref={trigger} type="button" aria-controls={panelId} aria-label="Open classroom call" aria-expanded={open} title="Classroom · video, screen sharing and local recording" onClick={()=>setOpen(previous=>!previous)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10"><Video className="h-4 w-4"/><span className="hidden lg:inline">Classroom</span>{connected&&<span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>}</button>
    {typeof document!=='undefined'&&createPortal(<aside id={panelId} aria-label="Classroom call" className={`${open?'flex':'hidden'} fixed bottom-3 right-3 top-14 z-50 w-[min(560px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 text-white shadow-2xl`}>
      <header className="flex items-center justify-between border-b border-neutral-700 p-3"><h2 className="text-sm font-semibold">Classroom {connected&&<span className="ml-1 text-xs font-normal text-neutral-400">· {state.peers.length+1} people</span>}</h2><button aria-label="Minimize classroom" title="Minimize · call stays connected" onClick={minimize} className="note-tool"><X className="h-4 w-4"/></button></header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {roomId&&<div className="space-y-1.5"><label htmlFor={`${panelId}-invite`} className="text-xs text-neutral-400">Classroom invite link</label><div className="flex gap-2"><input id={`${panelId}-invite`} ref={inviteInput} readOnly aria-label="Classroom invite link" value={inviteLink} onFocus={e=>e.target.select()} className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-xs text-neutral-300"/><button type="button" onClick={()=>void copyInvite()} className={control}><Copy className="h-3.5 w-3.5"/>Copy</button></div><p aria-live="polite" className="text-[11px] text-neutral-400">{(copyStatus.link===inviteLink&&copyStatus.message)||'Anyone with this link can edit the board and notes and join the call.'}</p></div>}
        {!roomId?<div className="space-y-3 p-2"><p className="text-sm text-neutral-400">Create a shared room to invite students, edit together and join a call.</p>{onCreateRoom&&<button disabled={!!busy} onClick={()=>void createRoom()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm disabled:opacity-50">{busy==='create'?'Creating room…':'Create room & open classroom'}</button>}<p className="text-xs text-neutral-500">To join an existing class, open its invite link or use Share.</p></div>:!connected?<form noValidate className="space-y-4 p-2" onSubmit={e=>{e.preventDefault();join();}}><p className="text-sm text-neutral-400">Talk and share your screen while working on the same canvas, code and notes. Camera and microphone start off.</p><label className="block text-xs">Your display name<input ref={input} maxLength={40} value={name} aria-invalid={!!error&&!name.trim()} aria-describedby={error?'classroom-error':undefined} onChange={e=>setName(e.target.value)} className="mt-2 block w-full rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-sm"/></label><button disabled={busy==='join'} className="rounded-lg bg-blue-600 px-4 py-2 text-sm disabled:opacity-50">{busy==='join'?'Joining…':state?.status==='disconnected'?'Rejoin class':'Join class'}</button>{state?.status==='disconnected'&&<p role="status" className="text-xs text-amber-300">The call disconnected. Your board edits stay in the room. Rejoin to reconnect.</p>}</form>:<>
          <div role="toolbar" aria-label="Call controls" className="flex flex-wrap gap-2"><button className={`${control} ${state.media.mic?'text-blue-300':''}`} disabled={!!busy} aria-pressed={state.media.mic} onClick={()=>void act('mic')}><Mic className="h-4 w-4"/>{state.media.mic?'Mute':'Microphone'}</button><button className={`${control} ${state.media.camera?'text-blue-300':''}`} disabled={!!busy} aria-pressed={state.media.camera} onClick={()=>void act('camera')}><Video className="h-4 w-4"/>{state.media.camera?'Camera off':'Camera'}</button><button className={`${control} ${state.media.screen?'text-blue-300':''}`} disabled={!!busy} aria-pressed={state.media.screen} onClick={()=>void act('screen')}><MonitorUp className="h-4 w-4"/>{state.media.screen?'Stop sharing':'Share screen'}</button><button className={`${control} text-rose-300`} onClick={leave}><PhoneOff className="h-4 w-4"/>Leave call</button></div>
          <ClassroomAudioSource deviceId={state.microphoneId} label={state.microphoneLabel} enabled={state.media.mic} busy={!!busy} onChange={id=>void selectMicrophone(id)}/>
          <p className="text-[11px] text-neutral-500">Small-group call · up to {state.maxParticipants} people{!state.relayConfigured?' · no network relay configured':''}</p>
          {state.screen&&<figure><MediaVideo stream={state.screen} label="Your shared screen"/><figcaption className="mt-1 text-xs text-neutral-400">Your screen · {state.screen.getAudioTracks().length?'screen/tab audio shared':'screen/tab audio off'}</figcaption></figure>}
          {state.peers.filter(p=>p.media.screen).map(peer=><figure key={`screen-${peer.id}`}><MediaVideo stream={peer.screen} label={`${peer.name}'s screen`}/><figcaption className="mt-1 text-xs text-neutral-400">{peer.name} · screen</figcaption></figure>)}
          <div className="grid grid-cols-2 gap-2"><figure className="overflow-hidden rounded-lg border border-neutral-800">{state.media.camera?<MediaVideo stream={state.camera} label="Your camera"/>:<div className="flex aspect-video items-center justify-center bg-neutral-950 text-2xl text-neutral-500">{name.slice(0,1).toUpperCase()}</div>}<figcaption className="px-2 py-1 text-xs text-neutral-400">You · {state.media.mic?'mic on':'muted'}</figcaption></figure>{state.peers.map(peer=><figure key={peer.id} className="overflow-hidden rounded-lg border border-neutral-800">{peer.media.camera?<MediaVideo stream={peer.camera} label={`${peer.name}'s camera`}/>:<div className="flex aspect-video items-center justify-center bg-neutral-950 text-2xl text-neutral-500">{peer.name.slice(0,1).toUpperCase()}</div>}<figcaption className="truncate px-2 py-1 text-xs text-neutral-400">{peer.name} · {peer.status==='connected'?peer.media.mic?'mic on':'muted':peer.status}</figcaption></figure>)}</div>
          {!state.peers.length&&<p role="status" className="py-2 text-xs text-neutral-400">You’re the first here. Invite students using the room’s Share link.</p>}
          <details className="rounded-lg border border-neutral-800 p-3"><summary className="cursor-pointer text-xs text-neutral-300">Class chat ({state.messages.length})</summary><p className="my-2 text-[11px] text-neutral-500">Chat is temporary and is not saved with the board.</p><ol aria-live="polite" aria-label="Class messages" className="max-h-44 space-y-2 overflow-y-auto text-xs">{state.messages.map((m,i)=><li key={`${m.id}-${m.at}-${i}`} className="break-words"><span className="text-blue-300">{m.name}: </span>{m.text}</li>)}</ol><form noValidate className="mt-3 flex gap-2" onSubmit={e=>{e.preventDefault();client.current?.chat(chat);setChat('');}}><input aria-label="Class chat message" maxLength={2000} value={chat} onChange={e=>setChat(e.target.value)} placeholder="Message the class…" className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 p-2 text-xs"/><button disabled={!chat.trim()} className={control}>Send</button></form></details>
        </>}
        {state?.peers.map(peer=><PeerAudio key={peer.id} stream={peer.audio} name={peer.name}/>)}
        {error&&<p id="classroom-error" role="alert" className="text-xs text-rose-300">{error}</p>}
      </div><LocalRecorder/>
    </aside>,document.body)}
  </>;
}
