import {test,expect,beforeAll,afterAll,beforeEach,afterEach} from 'bun:test';
import React,{act} from 'react';
import {Window} from 'happy-dom';
import {Reminders} from '../components/Reminders.tsx';
import {REMINDERS_KEY,createReminder,localDate} from '../lib/reminders.ts';
let browser,root,createRoot;const saved=new Map();
beforeAll(async()=>{
 browser=new Window({url:'http://localhost:3000'});
 for(const [key,value]of Object.entries({window:browser,document:browser.document,navigator:browser.navigator,HTMLElement:browser.HTMLElement,localStorage:browser.localStorage,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
 ({createRoot}=await import('react-dom/client'));
});
beforeEach(()=>{localStorage.clear();document.body.innerHTML='<button id="launcher">Reminders</button><main></main>';root=createRoot(document.querySelector('main'));});
afterEach(async()=>{await act(async()=>root.unmount());});
afterAll(()=>{browser.close();for(const [key,old]of saved)if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];});
const render=async(open=true,onClose=()=>{})=>{await act(async()=>{root.render(React.createElement(Reminders,{open,onClose}));await new Promise(resolve=>setTimeout(resolve,20));});await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});};
const click=async(label)=>{const b=[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===label||n.getAttribute('aria-label')===label);expect(b).toBeDefined();await act(async()=>b.click());};
const change=async(input,value)=>{await act(async()=>{Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new browser.Event('input',{bubbles:true}));input.dispatchEvent(new browser.Event('change',{bubbles:true}));});};
function dueReminder(){const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);return {...createReminder('Finish sketch',{kind:'once',start:localDate(tomorrow),time:'12:00',days:[]},1,false),nextDue:Date.now()-10000};}
test('overdue alarms activate outside the manager, survive reload and stop only on Done',async()=>{
 localStorage.setItem(REMINDERS_KEY,JSON.stringify([dueReminder()]));await render(false);
 await act(async()=>window.dispatchEvent(new browser.Event('focus')));
 expect(document.querySelector('[aria-label="Active reminders"]')?.textContent).toContain('Finish sketch');
 await act(async()=>root.unmount());root=createRoot(document.querySelector('main'));await render(false);
 expect(document.querySelector('[aria-label="Active reminders"]')).not.toBeNull();await click('Done');
 expect(document.querySelector('[aria-label="Active reminders"]')).toBeNull();expect(JSON.parse(localStorage.getItem(REMINDERS_KEY))[0].nextDue).toBeNull();
});
test('task form validates, creates a scheduled reminder and allows deleting it',async()=>{
 await render();await act(async()=>document.querySelector('form').dispatchEvent(new browser.Event('submit',{bubbles:true,cancelable:true})));
 expect(document.querySelector('[role="alert"]').textContent).toContain('task');
 await change(document.querySelector('input[maxlength="200"]'),'Review diagram');const future=new Date();future.setDate(future.getDate()+1);await change(document.querySelector('input[type=date]'),localDate(future));
 // Disable sound for deterministic browser testing.
 await act(async()=>document.querySelector('input[type=checkbox]').click());
 await act(async()=>document.querySelector('form').dispatchEvent(new browser.Event('submit',{bubbles:true,cancelable:true})));
 expect(JSON.parse(localStorage.getItem(REMINDERS_KEY))[0].title).toBe('Review diagram');expect(document.querySelector('[role="status"]').textContent).toContain('saved');
 await click('Delete reminder: Review diagram');expect(JSON.parse(localStorage.getItem(REMINDERS_KEY))).toEqual([]);expect(document.body.textContent).toContain('No reminders yet');
});
test('closing the manager restores focus and leaves active alarms unacknowledged',async()=>{
 localStorage.setItem(REMINDERS_KEY,JSON.stringify([{...dueReminder(),activeSince:Date.now()-10000,lastNotified:Date.now()}]));document.querySelector('#launcher').focus();let closed=false;
 await render(true,()=>{closed=true;});await click('Close reminders');expect(closed).toBe(true);await render(false);expect(document.activeElement.id).toBe('launcher');expect(document.querySelector('[aria-label="Active reminders"]')).not.toBeNull();
});
test('cross-tab completion removes an alarm and storage failure stays visible',async()=>{
 const item={...dueReminder(),activeSince:Date.now()-10000,lastNotified:Date.now()};localStorage.setItem(REMINDERS_KEY,JSON.stringify([item]));await render(false);
 await act(async()=>window.dispatchEvent(new browser.StorageEvent('storage',{key:REMINDERS_KEY,newValue:JSON.stringify([{...item,nextDue:null,activeSince:null}])})));expect(document.querySelector('[aria-label="Active reminders"]')).toBeNull();
 await render(true);const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>JSON.stringify([item]),setItem:()=>{throw new Error('blocked');}}});
 try{await click('Delete reminder: Finish sketch');expect(document.querySelector('[role="alert"]').textContent).toContain('session only');}finally{Object.defineProperty(globalThis,'localStorage',original);}
});
test('permission controls enable sound and system alarms close when marked Done',async()=>{
 const previousNotification=Object.getOwnPropertyDescriptor(globalThis,'Notification'),previousAudio=Object.getOwnPropertyDescriptor(globalThis,'AudioContext'),windowNotification=Object.getOwnPropertyDescriptor(window,'Notification');let beeps=0;const shown=[];
 class FakeNotification {static permission='default';static async requestPermission(){this.permission='granted';return 'granted';}constructor(title,options){this.title=title;this.options=options;shown.push(this);}close(){this.closed=true;}}
 class FakeAudio {state='suspended';currentTime=0;destination={};async resume(){this.state='running';}async close(){this.state='closed';}createOscillator(){return {frequency:{value:0},connect(){},disconnect(){},start(){beeps++;},stop(){}};}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}}
 Object.defineProperty(globalThis,'Notification',{configurable:true,value:FakeNotification});Object.defineProperty(window,'Notification',{configurable:true,value:FakeNotification});Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:FakeAudio});
 try{const r={...dueReminder(),sound:true};localStorage.setItem(REMINDERS_KEY,JSON.stringify([r]));await render();await click('Enable notifications');expect(document.body.textContent).toContain('Notifications enabled');await click('Enable & test sound');expect(beeps).toBe(3);
  await act(async()=>window.dispatchEvent(new browser.Event('focus')));expect(shown).toHaveLength(1);expect(shown[0].options.requireInteraction).toBe(true);expect(shown[0].options.silent).toBe(true);expect(beeps).toBe(6);await click('Done');expect(shown[0].closed).toBe(true);
 }finally{for(const [object,key,descriptor]of [[globalThis,'Notification',previousNotification],[globalThis,'AudioContext',previousAudio],[window,'Notification',windowNotification]])if(descriptor)Object.defineProperty(object,key,descriptor);else delete object[key];}
});
