import {test,expect,beforeAll,beforeEach,afterEach,afterAll} from 'bun:test';
import React,{act} from 'react';
import {Window} from 'happy-dom';
import {SearchParamsContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime.js';
import {ClassroomAudioSource} from '../components/ClassroomAudioSource.tsx';
import {InstallWebApp} from '../components/InstallWebApp.tsx';
import {RefreshWebApp} from '../components/RefreshWebApp.tsx';
import manifest from '../app/manifest.ts';
import { RoomChat } from '../components/RoomChat.tsx';
import { CollaborationPanel } from '../components/CollaborationPanel.tsx';
import {CallParticipants} from '../components/CallParticipants.tsx';
import {RoomJoinForm} from '../components/RoomJoinForm.tsx';
import {CallScreenView} from '../components/CallScreenView.tsx';
import {Classroom} from '../components/Classroom.tsx';
let browser,root,createRoot;const previous=new Map();
beforeAll(async()=>{
 browser=new Window({url:'https://desk.example/'});
 const values={window:browser,document:browser.document,navigator:browser.navigator,HTMLElement:browser.HTMLElement,Node:browser.Node,Event:browser.Event,MouseEvent:browser.MouseEvent,KeyboardEvent:browser.KeyboardEvent,requestAnimationFrame:browser.requestAnimationFrame.bind(browser),cancelAnimationFrame:browser.cancelAnimationFrame.bind(browser),IS_REACT_ACT_ENVIRONMENT:true};
 for(const [key,value]of Object.entries(values)){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
 ({createRoot}=await import('react-dom/client'));
});
beforeEach(()=>{document.body.innerHTML='<header style="backdrop-filter:blur(12px);height:44px"><div id="root"></div></header>';root=createRoot(document.getElementById('root'));});
afterEach(async()=>{await act(async()=>root.unmount());await browser.happyDOM.abort();});
afterAll(()=>{browser.close();for(const [key,value]of previous)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];});
async function render(props={},query=''){await act(async()=>root.render(React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams(query)},React.createElement(Classroom,props))));}
const trigger=()=>document.querySelector('[aria-label="Open live call"]');
const panel=()=>document.querySelector('[aria-label="Live call"]');
const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes(text));
test('Refresh checks the current room URL, saves latest edits and blocks duplicate clicks',async()=>{
 const originalFetch=globalThis.fetch,originalReload=window.location.reload,originalUrl=window.location.href;
 const id=crypto.randomUUID(),order=[];let finish,requests=0;
 window.history.replaceState(null,'',`/canvas/${id}?classroom=1`);
 globalThis.fetch=async(url,options)=>{requests++;expect(url).toBe(window.location.href);expect(options.method).toBe('HEAD');expect(options.cache).toBe('no-store');return new Promise(resolve=>{finish=resolve;});};
 window.location.reload=()=>order.push('reload');
 try{
  await act(async()=>root.render(React.createElement(RefreshWebApp,{onBeforeRefresh:()=>order.push('old save')})));
  const refresh=()=>document.querySelector('[aria-label="Refresh app"]');
  await act(async()=>{refresh().click();refresh().click();});expect(requests).toBe(1);expect(refresh().disabled).toBe(true);expect(order).toEqual([]);
  await act(async()=>root.render(React.createElement(RefreshWebApp,{onBeforeRefresh:()=>order.push('latest save')})));
  await act(async()=>finish(new Response(null,{status:200})));
  expect(order).toEqual(['latest save','reload']);expect(window.location.href).toContain(`/${id}?classroom=1`);
 }finally{globalThis.fetch=originalFetch;window.location.reload=originalReload;window.history.replaceState(null,'',originalUrl);}
});
test('Refresh leaves the app open after network or save failures and allows retry',async()=>{
 const originalFetch=globalThis.fetch,originalReload=window.location.reload;let reloads=0,failSave=true;
 globalThis.fetch=async()=>new Response(null,{status:503});window.location.reload=()=>reloads++;
 try{
  await act(async()=>root.render(React.createElement(RefreshWebApp,{onBeforeRefresh:()=>{if(failSave)throw new Error('Could not save work.');}})));
  await act(async()=>document.querySelector('[aria-label="Refresh app"]').click());expect(reloads).toBe(0);expect(document.querySelector('[role="alert"]').textContent).toContain('could not be loaded');
  globalThis.fetch=async()=>new Response(null,{status:200});
  await act(async()=>document.querySelector('[aria-label="Refresh app"]').click());expect(reloads).toBe(0);expect(document.querySelector('[role="alert"]').textContent).toContain('Could not save work');
  failSave=false;await act(async()=>document.querySelector('[aria-label="Refresh app"]').click());expect(reloads).toBe(1);expect(document.querySelector('[role="alert"]')).toBe(null);
 }finally{globalThis.fetch=originalFetch;window.location.reload=originalReload;}
});
test('Refresh is available without browser chrome and is disabled during recording',async()=>{
 let prepared=0;
 await act(async()=>root.render(React.createElement(RefreshWebApp,{recording:true,onBeforeRefresh:()=>prepared++})));
 const refresh=document.querySelector('[aria-label="Refresh app"]');expect(refresh.disabled).toBe(true);expect(refresh.title).toContain('Stop and save');await act(async()=>refresh.click());expect(prepared).toBe(0);
 await act(async()=>root.render(React.createElement(RefreshWebApp,{recording:false,onBeforeRefresh:()=>prepared++})));expect(document.querySelector('[aria-label="Refresh app"]').disabled).toBe(false);
});
test('a recording started during the update check prevents reloading',async()=>{
 const originalFetch=globalThis.fetch,originalReload=window.location.reload;let finish,reloads=0;
 globalThis.fetch=async()=>new Promise(resolve=>{finish=resolve;});window.location.reload=()=>reloads++;
 try{
  await act(async()=>root.render(React.createElement(RefreshWebApp,{recording:false,onBeforeRefresh:()=>{}})));
  await act(async()=>document.querySelector('[aria-label="Refresh app"]').click());
  await act(async()=>root.render(React.createElement(RefreshWebApp,{recording:true,onBeforeRefresh:()=>{}})));
  await act(async()=>finish(new Response(null,{status:200})));
  expect(reloads).toBe(0);expect(document.querySelector('[role="alert"]').textContent).toContain('Stop and save your recording');
 }finally{globalThis.fetch=originalFetch;window.location.reload=originalReload;}
});
test('Classroom click opens outside the blurred header and Escape minimizes with focus restoration',async()=>{
 await render();expect(panel().classList.contains('hidden')).toBe(true);
 await act(async()=>trigger().click());expect(trigger().getAttribute('aria-expanded')).toBe('true');expect(panel().classList.contains('hidden')).toBe(false);expect(panel().parentElement).toBe(document.body);expect(document.querySelector('header').contains(panel())).toBe(false);
 await act(async()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape'})));expect(trigger().getAttribute('aria-expanded')).toBe('false');expect(panel().classList.contains('hidden')).toBe(true);expect(document.activeElement).toBe(trigger());
});
test('Classroom offers personal-board room creation and keeps failures visible for retry',async()=>{
 let attempts=0;await render({onCreateRoom:async()=>{attempts++;if(attempts===1)throw new Error('Room server unavailable');}});
 await act(async()=>trigger().click());const create=button('Create room & open call');expect(create).toBeDefined();
 await act(async()=>create.click());expect(attempts).toBe(1);expect(document.querySelector('[role="alert"]').textContent).toBe('Room server unavailable');expect(create.disabled).toBe(false);
 await act(async()=>create.click());expect(attempts).toBe(2);expect(document.querySelector('[role="alert"]')).toBe(null);
});
test('a newly created classroom room opens the panel and focuses the name field',async()=>{
 await render({roomId:crypto.randomUUID()},'classroom=1');await act(async()=>new Promise(resolve=>requestAnimationFrame(resolve)));
 expect(trigger().getAttribute('aria-expanded')).toBe('true');expect(panel().classList.contains('hidden')).toBe(false);expect(button('Join call')).toBeDefined();expect(document.activeElement).toBe(panel().querySelector('input[maxlength="40"]'));
});
test('call invite is visible before joining, copyable, and selectable when clipboard fails',async()=>{
 const roomId=crypto.randomUUID(),original=Object.getOwnPropertyDescriptor(navigator,'clipboard');let copied;
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text;}}});
 try{
  await render({roomId},'classroom=1');const link=panel().querySelector('[aria-label="Call invite link"]');
  expect(link.value).toBe(`https://desk.example/v/${(await import('../lib/shortRoomCode.ts')).shortRoomCode(roomId)}`);
  await act(async()=>button('Copy').click());expect(copied).toBe(link.value);expect(panel().textContent).toContain('Invite link copied');
  navigator.clipboard.writeText=async()=>{throw new Error('Blocked');};await act(async()=>button('Copy').click());expect(document.activeElement).toBe(link);expect(link.selectionEnd).toBe(link.value.length);expect(panel().textContent).toContain('Select and copy');
 }finally{if(original)Object.defineProperty(navigator,'clipboard',original);else delete navigator.clipboard;}
});
test('audio source shows Auto microphone name and refreshes when devices change without capturing',async()=>{
 const original=Object.getOwnPropertyDescriptor(navigator,'mediaDevices'),media=new window.EventTarget();let devices=[{kind:'audioinput',deviceId:'usb',label:'USB mic'}],chosen;
 media.enumerateDevices=async()=>devices;media.getUserMedia=()=>{throw new Error('Must not capture to list sources');};Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:media});
 try{
  const props={deviceId:'',label:'USB mic',enabled:true,busy:false,onChange:id=>chosen=id};
  await act(async()=>root.render(React.createElement(ClassroomAudioSource,props)));
  const select=document.querySelector('select');expect(select.options[0].textContent).toBe('Auto · USB mic');expect(document.querySelector('[role="status"]').textContent).toBe('Using: USB mic');
  await act(async()=>{select.value='usb';select.dispatchEvent(new window.Event('change',{bubbles:true}));});expect(chosen).toBe('usb');
  devices=[{kind:'audioinput',deviceId:'new',label:'New USB mic'}];await act(async()=>button('Redetect microphones').click());expect(select.options[1].textContent).toBe('New USB mic');
  devices=[];await act(async()=>media.dispatchEvent(new window.Event('devicechange')));expect(select.options).toHaveLength(1);
  await act(async()=>root.render(React.createElement(ClassroomAudioSource,{...props,enabled:false,label:''})));expect(document.querySelector('[role="status"]').textContent).toContain('Microphone off');
 }finally{if(original)Object.defineProperty(navigator,'mediaDevices',original);else delete navigator.mediaDevices;}
});
test('web app installs through the captured browser prompt and handles installed state',async()=>{
 await act(async()=>root.render(React.createElement(InstallWebApp)));let prompted=0;
 const event=new window.Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{prompted++;};event.userChoice=Promise.resolve({outcome:'accepted'});
 await act(async()=>window.dispatchEvent(event));expect(event.defaultPrevented).toBe(true);
 await act(async()=>document.querySelector('[aria-label="Install web app"]').click());expect(prompted).toBe(1);
 await act(async()=>window.dispatchEvent(new window.Event('appinstalled')));expect(document.querySelector('[aria-label="Web app installed"]').disabled).toBe(true);
});
test('web app provides manual installation instructions and a scoped standalone manifest',async()=>{
 await act(async()=>root.render(React.createElement(InstallWebApp)));await act(async()=>document.querySelector('[aria-label="Install web app"]').click());
 const dialog=document.querySelector('dialog');expect(dialog.open).toBe(true);expect(dialog.parentElement).toBe(document.body);expect(dialog.textContent).toContain('Add to Home Screen');
 await act(async()=>document.querySelector('[aria-label="Close installation instructions"]').click());expect(dialog.open).toBe(false);
 const config=manifest();expect(config.start_url).toBe('/');expect(config.scope).toBe('/');expect(config.display).toBe('standalone');expect(config.icons.map(i=>i.sizes)).toEqual(['192x192','512x512']);
});


test('room chat preserves drafts on failed or disconnected sends, handles IME and Shift+Enter, and renders plain text',async()=>{
 let connected=true, fail=true, sent=[];
 const message={id:'one',author:1,name:'Alice',text:'<script>alert(1)</script>\nHello',at:Date.now()};
 const show=()=>root.render(React.createElement(RoomChat,{messages:[message],connected,onSend:text=>{if(fail)throw new Error('Send failed');sent.push(text);}}));
 await act(async()=>show());expect(document.querySelector('script')).toBeNull();expect(document.body.textContent).toContain('<script>');
 const input=document.querySelector('textarea'),setter=Object.getOwnPropertyDescriptor(browser.HTMLTextAreaElement.prototype,'value').set;
 await act(async()=>{setter.call(input,'My draft');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
 await act(async()=>input.dispatchEvent(new window.KeyboardEvent('keydown',{bubbles:true,key:'Enter',isComposing:true})));expect(sent).toEqual([]);expect(input.value).toBe('My draft');
 await act(async()=>input.dispatchEvent(new window.KeyboardEvent('keydown',{bubbles:true,key:'Enter',shiftKey:true})));expect(sent).toEqual([]);
 await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));expect(input.value).toBe('My draft');expect(document.querySelector('[role="alert"]').textContent).toBe('Send failed');
 connected=false;await act(async()=>show());expect(button('Send').disabled).toBe(true);expect(input.value).toBe('My draft');
 fail=false;connected=true;await act(async()=>show());await act(async()=>input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));expect(sent).toEqual(['My draft']);expect(input.value).toBe('');
});
test('collaboration and call chat share one conversation without joining media, with focus and drafts preserved',async()=>{
 const roomId=crypto.randomUUID();let sent=[];
 function App(){const[messages,setMessages]=React.useState([]);const roomChat={messages,connected:true,onSend:text=>{sent.push(text);setMessages(current=>[...current,{id:crypto.randomUUID(),name:'Alice',author:1,text,at:Date.now()}]);}};return React.createElement(React.Fragment,null,React.createElement(Classroom,{roomId,roomChat}),React.createElement(CollaborationPanel,{roomId,roomChat,status:'connected',people:[],onCreate:async()=>{},onJoin(){},onName(){},onLeave(){}}));}
 await act(async()=>root.render(React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams()},React.createElement(App))));
 const inputSetter=Object.getOwnPropertyDescriptor(browser.HTMLTextAreaElement.prototype,'value').set;
 await act(async()=>document.querySelector('[aria-label="Open room chat"]').click());
 let input=document.querySelector('[aria-label="Room chat message"]');expect(document.activeElement===input).toBe(true);
 await act(async()=>{inputSetter.call(input,'Hello room');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
 await act(async()=>input.closest('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
 await act(async()=>document.querySelector('[aria-label="Close collaboration"]').click());
 await act(async()=>trigger().click());await act(async()=>document.querySelector('[aria-label="Show call chat"]').click());
 input=document.querySelector('[aria-label="Call chat message"]');expect(document.activeElement===input).toBe(true);expect(panel().querySelector('[aria-label="Call chat messages"]').textContent).toContain('Hello room');
 expect(button('Join call')).toBeDefined();
 await act(async()=>{inputSetter.call(input,'Reply from call');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
 await act(async()=>input.closest('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
 expect(sent).toEqual(['Hello room','Reply from call']);expect(document.querySelector('[aria-label="Room chat messages"]').textContent).toContain('Reply from call');
 await act(async()=>{inputSetter.call(input,'Unsent draft');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
 await act(async()=>document.querySelector('[aria-label="Hide call chat"]').click());await act(async()=>document.querySelector('[aria-label="Show call chat"]').click());expect(input.value).toBe('Unsent draft');
});

test('screen viewing expands with fit/actual size, full screen uses a surface and Escape restores focus',async()=>{
 const stream=new window.MediaStream();stream.getTracks=()=>[];stream.getVideoTracks=()=>[];
 await act(async()=>root.render(React.createElement(CallScreenView,{stream,label:'Shared screen',detail:'Alice · screen'})));
 const enlarge=document.querySelector('[aria-label="Enlarge Shared screen"]');await act(async()=>enlarge.click());
 const dialog=document.querySelector('dialog');expect(dialog.open).toBe(true);expect(dialog.getAttribute('aria-label')).toBe('Shared screen');
 const size=document.querySelector('[aria-label="Screen viewing size"]');await act(async()=>{size.value='actual';size.dispatchEvent(new window.Event('change',{bubbles:true}));});expect(dialog.querySelector('video').classList.contains('max-w-none')).toBe(true);
 const surface=dialog.firstElementChild;let requested=false;surface.requestFullscreen=async()=>{requested=true;};
 await act(async()=>[...dialog.querySelectorAll('button')].find(b=>b.textContent.trim()==='Full screen').click());expect(requested).toBe(true);expect(surface.tagName).toBe('DIV');
 surface.requestFullscreen=async()=>{throw new Error('Not supported');};await act(async()=>[...dialog.querySelectorAll('button')].find(b=>b.textContent.trim()==='Full screen').click());expect(dialog.querySelector('[role="alert"]').textContent).toContain('expanded view');
 await act(async()=>dialog.dispatchEvent(new window.Event('cancel',{cancelable:true})));await act(async()=>new Promise(resolve=>requestAnimationFrame(resolve)));expect(dialog.open).toBe(false);expect(document.activeElement).toBe(enlarge);
});

test('Live call includes link joining, validates input and opens the requested call without capture',async()=>{
 let joined;await render({onJoinRoom:id=>joined=id});await act(async()=>trigger().click());
 const field=document.querySelector('[aria-label="Call link or room ID"]');expect(field).not.toBe(null);
 const setValue=async value=>act(async()=>{const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;setter.call(field,value);field.dispatchEvent(new window.Event('input',{bubbles:true}));});
 await setValue('invalid link');await act(async()=>field.form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));expect(field.getAttribute('aria-invalid')).toBe('true');expect(document.activeElement).toBe(field);expect(joined).toBeUndefined();
 const id=crypto.randomUUID();await setValue(`https://desk.example/canvas/${id}`);await act(async()=>field.form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));expect(joined).toBe(id);
});
test('shared join form preserves call intent and blocks duplicate pending joins',async()=>{
 let calls=0,resolve;const id=crypto.randomUUID();await act(async()=>root.render(React.createElement(RoomJoinForm,{call:true,onJoin:(room,openCall)=>{expect(room).toBe(id);expect(openCall).toBe(true);calls++;return new Promise(done=>resolve=done);}})));
 const field=document.querySelector('input');await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(field,id);field.dispatchEvent(new window.Event('input',{bubbles:true}));});
 await act(async()=>{field.form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));field.form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));});expect(calls).toBe(1);expect(button('Opening').disabled).toBe(true);await act(async()=>resolve());expect(button('Open call').disabled).toBe(false);
});
test('noise cancellation is visible, accessible and cannot change while a source is busy',async()=>{
 let noise;const props={deviceId:'',label:'USB mic',enabled:true,busy:false,onChange(){},noiseSuppression:true,onNoiseChange:enabled=>noise=enabled,processing:{echoCancellation:true,noiseSuppression:true}};
 await act(async()=>root.render(React.createElement(ClassroomAudioSource,props)));const toggle=document.querySelector('input[type="checkbox"]');expect(toggle.checked).toBe(true);await act(async()=>toggle.click());expect(noise).toBe(false);
 await act(async()=>root.render(React.createElement(ClassroomAudioSource,{...props,busy:true})));expect(document.querySelector('input[type="checkbox"]').disabled).toBe(true);
});

test('screen tiles expose direct full screen and return focus to that action after closing',async()=>{
 const stream=new window.MediaStream();stream.getTracks=()=>[];stream.getVideoTracks=()=>[];
 await act(async()=>root.render(React.createElement(CallScreenView,{stream,label:'Alice screen',detail:'Alice'})));
 const direct=document.querySelector('[aria-label="Full screen Alice screen"]'),dialog=document.querySelector('dialog');let requested=0;dialog.firstElementChild.requestFullscreen=async()=>{requested++;};
 expect(dialog.open).toBe(false);await act(async()=>direct.click());expect(dialog.open).toBe(true);expect(requested).toBe(1);
 await act(async()=>dialog.querySelector('[aria-label="Close enlarged screen"]').click());await act(async()=>new Promise(resolve=>requestAnimationFrame(resolve)));expect(document.activeElement).toBe(direct);
});

test('participant strips show speaking, microphone and roles with host-only co-host actions',async()=>{
 const people=[{id:'host',name:'Alice',role:'host',mic:true,speaking:true,self:true},{id:'guest',name:'Bob',role:'participant',mic:false,speaking:false}];let action;
 await act(async()=>root.render(React.createElement(CallParticipants,{people,role:'host',onModerate:(...args)=>action=args})));
 expect(document.querySelector('[data-participant="host"]').getAttribute('aria-label')).toContain('speaking');expect(document.querySelector('[data-participant="guest"]').getAttribute('aria-label')).toContain('microphone off');
 await act(async()=>button('Make co-host').click());expect(action).toEqual(['promote','guest']);
 await act(async()=>button('Remove from call').click());expect(action).toEqual(['promote','guest']);const confirmation=document.querySelector('dialog[open]');expect(confirmation.textContent).toContain('Bob');expect(confirmation.textContent).toContain('rejoin');await act(async()=>[...confirmation.querySelectorAll('button')].find(b=>b.textContent==='Remove from call').click());expect(action).toEqual(['remove','guest']);
 await act(async()=>root.render(React.createElement(CallParticipants,{people,role:'participant',onModerate(){}})));expect(button('Make co-host')).toBeUndefined();expect(document.querySelector('summary')).toBe(null);
});
test('call expansion and header full-screen controls use the call surface and restore its size',async()=>{
 await render();await act(async()=>trigger().click());await act(async()=>document.querySelector('[aria-label="Expand call"]').click());expect(panel().classList.contains('inset-3')).toBe(true);
 let requests=0;panel().requestFullscreen=async()=>{requests++;};await act(async()=>document.querySelector('[aria-label="Full screen call"]').click());expect(requests).toBe(1);
 await act(async()=>document.querySelector('[aria-label="Restore call size"]').click());expect(panel().classList.contains('inset-3')).toBe(false);
});

test('opening a short video invite immediately opens the call panel',async()=>{
 const {PathnameContext}=await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js');
 const {shortRoomCode}=await import('../lib/shortRoomCode.ts');const roomId=crypto.randomUUID();
 await act(async()=>root.render(React.createElement(PathnameContext.Provider,{value:`/v/${shortRoomCode(roomId)}`},React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams()},React.createElement(Classroom,{roomId})))));
 expect(panel()).not.toBeNull();expect(panel().querySelector('[aria-label="Call invite link"]').value).toContain('/v/');
});
