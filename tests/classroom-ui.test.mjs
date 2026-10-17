import {test,expect,beforeAll,beforeEach,afterEach,afterAll} from 'bun:test';
import React,{act} from 'react';
import {Window} from 'happy-dom';
import {SearchParamsContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime.js';
import {ClassroomAudioSource} from '../components/ClassroomAudioSource.tsx';
import {InstallWebApp} from '../components/InstallWebApp.tsx';
import manifest from '../app/manifest.ts';
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
const trigger=()=>document.querySelector('[aria-label="Open classroom call"]');
const panel=()=>document.querySelector('[aria-label="Classroom call"]');
const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes(text));
test('Classroom click opens outside the blurred header and Escape minimizes with focus restoration',async()=>{
 await render();expect(panel().classList.contains('hidden')).toBe(true);
 await act(async()=>trigger().click());expect(trigger().getAttribute('aria-expanded')).toBe('true');expect(panel().classList.contains('hidden')).toBe(false);expect(panel().parentElement).toBe(document.body);expect(document.querySelector('header').contains(panel())).toBe(false);
 await act(async()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape'})));expect(trigger().getAttribute('aria-expanded')).toBe('false');expect(panel().classList.contains('hidden')).toBe(true);expect(document.activeElement).toBe(trigger());
});
test('Classroom offers personal-board room creation and keeps failures visible for retry',async()=>{
 let attempts=0;await render({onCreateRoom:async()=>{attempts++;if(attempts===1)throw new Error('Room server unavailable');}});
 await act(async()=>trigger().click());const create=button('Create room & open classroom');expect(create).toBeDefined();
 await act(async()=>create.click());expect(attempts).toBe(1);expect(document.querySelector('[role="alert"]').textContent).toBe('Room server unavailable');expect(create.disabled).toBe(false);
 await act(async()=>create.click());expect(attempts).toBe(2);expect(document.querySelector('[role="alert"]')).toBe(null);
});
test('a newly created classroom room opens the panel and focuses the name field',async()=>{
 await render({roomId:crypto.randomUUID()},'classroom=1');await act(async()=>new Promise(resolve=>requestAnimationFrame(resolve)));
 expect(trigger().getAttribute('aria-expanded')).toBe('true');expect(panel().classList.contains('hidden')).toBe(false);expect(button('Join class')).toBeDefined();expect(document.activeElement).toBe(panel().querySelector('input[maxlength="40"]'));
});
test('call invite is visible before joining, copyable, and selectable when clipboard fails',async()=>{
 const roomId=crypto.randomUUID(),original=Object.getOwnPropertyDescriptor(navigator,'clipboard');let copied;
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text;}}});
 try{
  await render({roomId},'classroom=1');const link=panel().querySelector('[aria-label="Classroom invite link"]');
  expect(link.value).toBe(`${(process.env.NEXT_PUBLIC_APP_URL||'https://desk.example').replace(/\/$/,'')}/canvas/${roomId}?classroom=1`);
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
