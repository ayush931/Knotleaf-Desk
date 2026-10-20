import { test,expect,beforeEach,afterEach } from 'bun:test';
import {loadPreferences,savePreferences,normalizePreferences} from '../lib/preferences.ts';
import {DEFAULT_STYLE} from '../draw/types.ts';
let old,records;
beforeEach(()=>{old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');records=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:{getItem:key=>records.get(key)||null,setItem:(key,value)=>records.set(key,value)}});});
afterEach(()=>{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete globalThis.localStorage;});
test('local style, eraser, notes and export preferences survive independent saves',()=>{
 expect(savePreferences({style:{...DEFAULT_STYLE,stroke:'#123456',fontFamily:'serif'},eraserSize:1000000,eraserMode:'drawings',notesWidth:470,notesHeight:420})).toBe(true);
 expect(savePreferences({exportFormat:'webp',exportScope:'notes',exportScale:3,exportTransparent:true})).toBe(true);
 const saved=loadPreferences();expect(saved.style.stroke).toBe('#123456');expect(saved.style.fontFamily).toBe('serif');expect(saved.eraserSize).toBe(1000000);expect(saved.eraserMode).toBe('drawings');expect(saved.notesWidth).toBe(470);expect(saved.notesHeight).toBe(420);expect(saved.exportScope).toBe('canvas');expect(saved.exportTransparent).toBe(true);
 expect(JSON.stringify(saved)).not.toContain('appearanceOpen');
});
test('invalid preferences recover safely and do not restore transient panel state',()=>{
 records.set('knotleaf.preferences.v1','broken');expect(loadPreferences().style).toEqual(DEFAULT_STYLE);
 const value=normalizePreferences({version:1,appearanceOpen:true,eraserSize:-1,eraserMode:'invalid',style:{fontSize:Infinity,stroke:'javascript:bad',fontFamily:'bad',arrowHeadEnd:'triangle'}});
 expect(value.style).toEqual(DEFAULT_STYLE);expect(value.eraserSize).toBe(24);expect(value.eraserMode).toBe('all');expect(value.appearanceOpen).toBeUndefined();
 expect(normalizePreferences({version:99,eraserSize:50}).eraserSize).toBe(24);
});
test('storage denial does not break drawing defaults or saving callers',()=>{
 localStorage.getItem=()=>{throw Error('blocked');};localStorage.setItem=()=>{throw Error('quota');};expect(loadPreferences().eraserSize).toBe(24);expect(savePreferences({eraserSize:300})).toBe(false);
});
