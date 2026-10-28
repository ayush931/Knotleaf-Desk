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

test('document reading preferences persist alongside canvas and export settings',()=>{
 savePreferences({noteAppearance:{font:'serif',size:20,width:'wide',lineHeight:2.1}});savePreferences({eraserSize:80,exportFormat:'pdf'});
 expect(loadPreferences().noteAppearance).toEqual({font:'serif',size:20,width:'wide',lineHeight:2.1});expect(loadPreferences().eraserSize).toBe(80);
 expect(normalizePreferences({noteAppearance:{font:'bad',size:-4,width:'bad',lineHeight:100}}).noteAppearance.font).toBe('sans');
});

test('noise cancellation defaults on and persists independently of drawing settings',()=>{
 expect(loadPreferences().callNoiseSuppression).toBe(true);savePreferences({callNoiseSuppression:false});savePreferences({eraserSize:55});expect(loadPreferences().callNoiseSuppression).toBe(false);expect(normalizePreferences({callNoiseSuppression:'off'}).callNoiseSuppression).toBe(true);
});
test('the rich-note typing size is saved and validated',()=>{
 expect(loadPreferences().noteTypingSize).toBeNull();
 expect(savePreferences({noteTypingSize:20})).toBe(true);expect(loadPreferences().noteTypingSize).toBe(20);
 expect(normalizePreferences({noteTypingSize:500}).noteTypingSize).toBeNull();
 expect(normalizePreferences({noteTypingSize:'18'}).noteTypingSize).toBeNull();
});

test('drawing tools retain independent colors through reloads and unrelated preference saves', () => {
 const legacy = normalizePreferences({ style: { ...DEFAULT_STYLE, stroke: '#123456' } });
 expect(legacy.toolColors.rectangle.stroke).toBe('#123456'); expect(legacy.toolColors.text.stroke).toBe('#123456');
 const colors = loadPreferences().toolColors;
 colors.rectangle.stroke = '#ef4444'; colors.rectangle.fill = '#48596b'; colors.rectangle.fillStyle = 'solid';
 savePreferences({ toolColors: colors }); savePreferences({ notesWidth: 450 });
 expect(loadPreferences().toolColors.rectangle).toMatchObject({ stroke: '#ef4444', fill: '#48596b', fillStyle: 'solid' });
 expect(loadPreferences().toolColors.text.stroke).toBe(DEFAULT_STYLE.stroke);
 expect(loadPreferences().toolColors.circle.fill).toBe(DEFAULT_STYLE.fill);
 const malformed = normalizePreferences({ toolColors: { rectangle: { stroke: 'bad', fillOpacity: 2 }, text: { stroke: '#22c55e' } } });
 expect(malformed.toolColors.rectangle).toEqual(loadPreferences().toolColors.circle);
 expect(malformed.toolColors.text.stroke).toBe('#22c55e');
});

test('selected-object color edits remember only changed fields for the matching tool types',async()=>{
 const {rememberToolColors,colorToolForElement}=await import('../draw/toolColors.ts');
 const original=loadPreferences().toolColors;
 original.rectangle.fill='#48596b';original.rectangle.fillStyle='solid';original.text.fill='#674c4b';
 const next=rememberToolColors(original,['rectangle','text','rectangle'],{stroke:'#FFFFFF',fontSize:28});
 expect(next.rectangle).toEqual({...original.rectangle,stroke:'#FFFFFF'});expect(next.text).toEqual({...original.text,stroke:'#FFFFFF'});
 expect(next.circle).toBe(original.circle);expect(original.rectangle.fill).toBe('#48596b');expect(next).not.toBe(original);
 expect(rememberToolColors(next,['rectangle'],{fontSize:32})).toBe(next);
 expect(colorToolForElement({type:'text',isCodeCard:true,isDocCard:true})).toBe('code');expect(colorToolForElement({type:'text',isDocCard:true})).toBe('doc');expect(colorToolForElement({type:'text'})).toBe('text');expect(colorToolForElement({type:'icon'})).toBeUndefined();
 savePreferences({toolColors:next});savePreferences({notesWidth:500});expect(loadPreferences().toolColors.rectangle).toEqual(next.rectangle);expect(loadPreferences().toolColors.text.fill).toBe('#674c4b');
});
