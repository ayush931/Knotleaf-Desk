import {beforeAll, afterEach, test, expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Window} from 'happy-dom';
import {compile} from '@tailwindcss/node';
import postcss from 'postcss';
import {transform} from 'lightningcss';
import {convert} from '@asamuzakjp/css-color';
import {BoardsSidebar} from '../components/BoardsSidebar.tsx';
import {workspacePalette,workspaceThemeStyle,workspaceControlPalette,WORKSPACE_THEMES} from '../lib/workspaceThemes.ts';
import {BrandMark} from '../components/BrandMark.tsx';
import {Reminders} from '../components/Reminders.tsx';
import {TopToolbar} from '../components/TopToolbar.tsx';
import {PropertiesPanel} from '../components/PropertiesPanel.tsx';
import {DEFAULT_STYLE} from '../draw/types.ts';
let css, browser;
const noop=()=>{};
const props={isOpen:true,onOpenChange:noop,selectedElement:null,selectionCount:1,currentStyle:DEFAULT_STYLE,onSwapArrow:noop,onChangeFontSize:noop,onUpdateStyle:noop,onUpdateElement:noop,onDuplicate:noop,onDelete:noop,onBringToFront:noop,onSendToBack:noop,onBackgroundChange:noop,theme:'light'};
beforeAll(async()=>{
 const source=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
 const components=['PropertiesPanel','ColorControl','ColorPalette','BackgroundStylePicker','FontSelect','BoardHeader','BoardsSidebar','Reminders','TopToolbar','BrandMark','WorkspaceThemes'];
 const candidates=new Set(components.flatMap(name=>readFileSync(new URL(`../components/${name}.tsx`,import.meta.url),'utf8').match(/[\w:.[\]#%/-]+/g)||[]));
 const compiler=await compile(source,{base:new URL('../app',import.meta.url).pathname,onDependency(){}});
 const ast=postcss.parse(transform({code:Buffer.from(compiler.build([...candidates])),targets:{chrome:80<<16}}).code.toString());
 // Happy DOM has no cascade-layer support; preserve the emitted layer order.
 ast.walkAtRules('layer',rule=>rule.nodes?rule.replaceWith(...rule.nodes):rule.remove());
 // Resolve modern color literals for Happy DOM's older color parser.
 ast.walkDecls(declaration=>{if(/^(lab|lch|oklab|oklch)\(/.test(declaration.value))declaration.value=convert.colorToHex(declaration.value)||declaration.value;});
 // Lower the app's class-based dark selector for this DOM's cascade parser.
 ast.walkRules(rule=>{rule.selector=rule.selector.replace(/(\.[^\s,]+):where\(\.dark, \.dark \*\)/g,'.dark $1');});
 css=ast.toString();
});
afterEach(()=>browser?.close());
function render(element,mode='light'){
 browser=new Window();const doc=browser.document;doc.documentElement.className=mode;
 doc.head.innerHTML=`<style>${css}</style>`;doc.body.innerHTML=renderToStaticMarkup(element);return doc;
}
const style=element=>browser.getComputedStyle(element);
function neutralLightness(color){
 if(color.startsWith('oklch('))return (Number(color.match(/[\d.]+/)[0])/(color.includes('%')?100:1))**3;
 const rgb=color.startsWith('#')?(color.length===4?color.slice(1).split('').map(c=>c+c).join(''):color.slice(1)).match(/../g).slice(0,3).map(v=>parseInt(v,16)):color.match(/[\d.]+/g)?.slice(0,3).map(Number);
 if(!rgb)throw Error(`Unsupported test color ${color}`);
 return rgb.map(n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
}
function readable(element,surface){
 const a=neutralLightness(style(element).color),b=neutralLightness(style(surface).backgroundColor);
 expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(4.5);
}
test('compiled light Appearance uses light option surfaces and readable selected text',()=>{
 const doc=render(React.createElement(PropertiesPanel,{...props,selectedTool:'text',selectedElement:{...DEFAULT_STYLE,id:'text',type:'text',text:'Example',fontSize:24,fontFamily:'sans',textAlign:'left'}}));
 const panel=doc.querySelector('[aria-label="Appearance settings"]');
 const font=doc.querySelector('[aria-label="Font family"] button[aria-pressed="true"]');
 expect(neutralLightness(style(font).backgroundColor)).toBeGreaterThan(.8);readable(font,font);
 const size=doc.querySelector('[aria-label="Increase font size"]');
 expect(neutralLightness(style(size).backgroundColor)).toBeGreaterThan(.8);readable(size,size);
 const input=doc.querySelector('[aria-label="Document card title"]')||doc.querySelector('#color-custom-stroke-color');
 expect(neutralLightness(style(input).backgroundColor)).toBeGreaterThan(.8);readable(input,input);
 readable(panel.querySelector('h2'),panel);
});
test('compiled arrow options, native choices, and active formatting stay readable in light mode',()=>{
 const doc=render(React.createElement(PropertiesPanel,{...props,selectedTool:'arrow'}));
 const selected=doc.querySelector('[aria-label="Arrow routing"] [aria-pressed="true"]');
 expect(neutralLightness(style(selected).backgroundColor)).toBeGreaterThan(.8);readable(selected,selected);
 const option=doc.querySelector('option');expect(neutralLightness(style(option).color)).toBeLessThan(.02);
 const legacy=doc.createElement('button');legacy.className='bg-purple-600 text-white';legacy.textContent='Bold';doc.body.append(legacy);readable(legacy,legacy);
});
test('legacy surfaces still adapt and dark mode retains its authored controls',()=>{
 const doc=render(React.createElement(PropertiesPanel,{...props,selectedTool:'text'}),'dark');
 const size=doc.querySelector('[aria-label="Increase font size"]');expect(neutralLightness(style(size).backgroundColor)).toBeLessThan(.1);readable(size,size);
 doc.documentElement.className='light';const legacy=doc.createElement('div');legacy.className='bg-neutral-900 text-neutral-200';doc.body.append(legacy);
 expect(neutralLightness(style(legacy).backgroundColor)).toBeGreaterThan(.8);readable(legacy,legacy);
});

test('expanded Appearance options keep inactive labels and form controls readable',()=>{
 const doc=render(React.createElement(PropertiesPanel,{...props,selectedTool:'rectangle'}));
 const details=doc.querySelector('details');details.open=true;
 const inactive=doc.querySelector('[title="Clean lines"]');readable(inactive,inactive.parentElement);
 for(const select of doc.querySelectorAll('select'))for(const option of select.options)readable(option,option);
});

test('workspace search and organization selects have readable light surfaces and options',()=>{
 const doc=render(React.createElement(BoardsSidebar,{isOpen:false,onClose:()=>{},boards:[],activeBoardId:'',workspaces:[{id:'personal',name:'Personal'}],workspaceId:'personal',onChangeWorkspace:()=>{},onCreateWorkspace:()=>{},onMoveBoard:()=>{},onSelectBoard:()=>{},onCreateBoard:()=>{},onDuplicateBoard:()=>{},onDeleteBoard:()=>{},onImportFile:async()=>{},theme:'light'}));
 for(const select of doc.querySelectorAll('select')){expect(neutralLightness(style(select).backgroundColor)).toBeGreaterThan(.8);readable(select,select);for(const option of select.options)readable(option,option);}
});


for(const mode of ['light','dark'])test(`bright drawing tools retain readable active and inactive icons in ${mode} mode`,()=>{
 const doc=render(React.createElement(TopToolbar,{selectedTool:'select',setSelectedTool:noop,onUndo:noop,onRedo:noop,canUndo:true,canRedo:true,onOpenIconPicker:noop,theme:mode}),mode);
 const toolbar=doc.querySelector('[aria-label="Drawing tools"]'),active=toolbar.querySelector('[aria-pressed="true"]'),inactive=toolbar.querySelector('[aria-label="Pan (H)"]');
 readable(active,active);readable(inactive,toolbar);
 const lightness=neutralLightness(style(toolbar).backgroundColor);if(mode==='light')expect(lightness).toBeGreaterThan(.9);else expect(lightness).toBe(0);
});


for(const {id} of WORKSPACE_THEMES)for(const mode of ['light','dark'])test(`${id} notes remain readable across rich, source and preview with opposite app mode (${mode})`,()=>{
 const p=workspacePalette(id,mode),section=React.createElement('section',{className:'notes-theme','data-notes-theme':id,style:workspaceThemeStyle(id,mode,true)},
  React.createElement('header',{className:'bg-neutral-900'},React.createElement('span',{id:'note-label',className:'text-neutral-400'},'Notes')),
  React.createElement('div',{className:'notes-rich'},React.createElement('div',{className:'tiptap',id:'rich-note'},'Rich text')),
  React.createElement('div',{className:'notes-source'},React.createElement('pre',{id:'source-paint'},React.createElement('span',{className:'hljs-keyword',id:'source-token'},'const')),React.createElement('textarea',{'aria-label':'Source caret'})),
  React.createElement('section',{className:'markdown-reader','data-theme':mode==='light'?'paper':'dark',id:'reader-note'},'Preview'));
 const doc=render(section,mode==='light'?'dark':'light'),root=doc.querySelector('section');
 readable(doc.getElementById('note-label'),doc.querySelector('header'));readable(doc.getElementById('rich-note'),root);readable(doc.getElementById('source-token'),root);readable(doc.getElementById('reader-note'),doc.getElementById('reader-note'));
 expect(neutralLightness(style(root).backgroundColor)).toBeCloseTo(neutralLightness(p.background));expect(['transparent','#0000','rgba(0, 0, 0, 0)']).toContain(style(doc.querySelector('textarea')).color);
});

for(const mode of ['light','dark'])test(`reminder fields and alarm actions remain readable in ${mode} mode`,()=>{
 const doc=render(React.createElement(Reminders,{open:true,onClose:noop}),mode);const dialog=doc.querySelector('dialog');
 readable(dialog,dialog);for(const input of doc.querySelectorAll('.reminder-field'))readable(input,input);const primary=doc.querySelector('.ui-primary');readable(primary,primary);
 expect(style(doc.querySelector('input[type=date]')).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
});

for(const {id}of WORKSPACE_THEMES)for(const mode of ['light','dark'])test(`${id} ${mode} chrome follows its palette across buttons, options, dialogs and Notes`,()=>{
 const other=mode==='light'?'dark':'light';const p=workspacePalette(id,mode),control=workspaceControlPalette(mode,id),noteControl=workspaceControlPalette(other,'forest');
 const doc=render(React.createElement('div',null,
  React.createElement(BrandMark),
  React.createElement('div',{className:'drawing-panel',id:'chrome-panel'},
   React.createElement('button',{id:'chrome-button',className:'text-neutral-400 hover:bg-neutral-800'},'Action'),
   React.createElement('button',{id:'chrome-selected','aria-pressed':true,className:'bg-neutral-800 text-neutral-200'},'Selected'),
   React.createElement('button',{id:'chrome-primary',className:'ui-primary'},'Save'),
   React.createElement('select',{id:'chrome-select',className:'bg-neutral-900 text-neutral-300'},React.createElement('option',{id:'chrome-option'},'Choice')),
   React.createElement('button',{id:'swatch',style:{backgroundColor:'#ef4444'}},'Artwork color')),
  React.createElement('dialog',{open:true,id:'portalled-dialog',className:'bg-neutral-900 text-neutral-200'},'Dialog'),
  React.createElement('section',{className:'notes-theme','data-notes-theme':'forest',style:workspaceThemeStyle('forest',other,true)},React.createElement('button',{'aria-pressed':true,id:'notes-selected',className:'text-neutral-200 bg-neutral-800'},'Bold'))),mode);
 doc.documentElement.setAttribute('data-workspace-ui','true');for(const [key,value]of Object.entries(workspaceThemeStyle(id,mode)))if(key.startsWith('--'))doc.documentElement.style.setProperty(key,value);
 for(const selector of ['#chrome-panel','#portalled-dialog','#chrome-select','#chrome-option']){const node=doc.querySelector(selector);expect(convert.colorToHex(style(node).backgroundColor),selector).toBe(p.panel);readable(node,node);}
 for(const selector of ['#chrome-selected','#chrome-primary']){const node=doc.querySelector(selector);expect(convert.colorToHex(style(node).backgroundColor)).toBe(selector==='#chrome-selected'?control.active:control.info);expect(convert.colorToHex(style(node).color)).toBe(selector==='#chrome-selected'?control['active-ink']:control['info-ink']);readable(node,node);}
 const selected=doc.querySelector('#notes-selected');expect(convert.colorToHex(style(selected).backgroundColor)).toBe(noteControl.active);expect(convert.colorToHex(style(selected).color)).toBe(noteControl['active-ink']);readable(selected,selected);
 expect(convert.colorToHex(style(doc.querySelector('#swatch')).backgroundColor)).toBe('#ef4444');expect(doc.querySelector('[data-brand-mark] path').getAttribute('fill')).toBe('var(--ui-brand)');
});

for(const {id}of WORKSPACE_THEMES)for(const mode of ['light','dark'])test(`${id} ${mode} action states use subtle emphasis from a single accent`,()=>{
 const control=workspaceControlPalette(mode,id),doc=render(React.createElement('div',null,...['info','success','pending','danger'].map(tone=>React.createElement('button',{'data-ui-tone':tone,key:tone,id:tone,className:'ui-primary'},tone))),mode);
 doc.documentElement.setAttribute('data-workspace-ui','true');for(const [key,value]of Object.entries(workspaceThemeStyle(id,mode)))if(key.startsWith('--'))doc.documentElement.style.setProperty(key,value);
 const colors=new Set();for(const tone of ['info','success','pending','danger']){const node=doc.getElementById(tone);expect(convert.colorToHex(style(node).backgroundColor)).toBe(control[tone]);expect(convert.colorToHex(style(node).color)).toBe(control[tone+'-ink']);readable(node,node);colors.add(style(node).backgroundColor);}expect(colors.size).toBe(3);const panel=workspacePalette(id,mode).panel;for(const tone of ['info','success'])for(const offset of [1,3,5])expect(Math.abs(parseInt(control[tone].slice(offset,offset+2),16)-parseInt(panel.slice(offset,offset+2),16))).toBeLessThanOrEqual(45);
});
