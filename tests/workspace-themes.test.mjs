import {test,expect} from 'bun:test';
import {WORKSPACE_THEMES,workspacePalette,normalizeWorkspaceThemes,applyWorkspaceTheme,workspaceThemeStyle,workspaceControlPalette} from '../lib/workspaceThemes.ts';
import {canvasBackground,canvasElementAppearance} from '../draw/canvasAppearance.ts';
const luminance=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
test('every theme has legible content, muted labels and primary actions in both modes',()=>{
 for(const {id}of WORKSPACE_THEMES)for(const mode of ['light','dark']){
  const p=workspacePalette(id,mode);for(const color of Object.values(p))expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(contrast(p.ink,p.background)).toBeGreaterThanOrEqual(7);expect(contrast(p.muted,p.panel)).toBeGreaterThanOrEqual(4.5);expect(contrast(p.accent,p.accentInk)).toBeGreaterThanOrEqual(4.5);
  expect(canvasBackground(undefined,mode,id).fill).toBe(p.background);expect(workspaceThemeStyle(id,mode,true)['--notes-ink']).toBe(p.ink);
 }
 expect(workspacePalette('mono','dark').background).toBe('#10232c');expect(workspacePalette('mono','light').background).toBe('#f0f9fc');
});
test('theme scope changes only the requested pane and Both restores linked light/dark mode',()=>{
 const original={canvas:'paper',notes:'forest',notesMode:'light'};
 expect(applyWorkspaceTheme(original,'slate','canvas')).toEqual({...original,canvas:'slate'});
 expect(applyWorkspaceTheme(original,'slate','notes')).toEqual({...original,notes:'slate'});
 expect(applyWorkspaceTheme(original,'slate','both')).toEqual({canvas:'slate',notes:'slate',notesMode:undefined});
 expect(original).toEqual({canvas:'paper',notes:'forest',notesMode:'light'});
});
test('bad theme preferences recover safely and custom canvas colors remain explicit',()=>{
 expect(normalizeWorkspaceThemes({canvas:'bad',notes:'forest',notesMode:'wrong'})).toEqual({canvas:'black',notes:'forest'});
 expect(normalizeWorkspaceThemes(null)).toEqual({canvas:'black',notes:'black'});
 const custom={fill:'#000000',fillStyle:'solid',fillOpacity:1};for(const {id}of WORKSPACE_THEMES)for(const mode of ['light','dark'])expect(canvasBackground(custom,mode,id)).toEqual(custom);
});
test('theme adaptation keeps text readable inside explicitly dark shapes on light canvas',()=>{
 const shape={id:'parent',type:'rectangle',fill:'#000000',fillStyle:'solid',fillOpacity:1,stroke:'#ffffff'};
 const text={id:'label',type:'text',containerId:'parent',fill:'transparent',fillStyle:'none',stroke:'#FFFFFF'};
 expect(canvasElementAppearance(text,true,[shape,text]).stroke).toBe('#FFFFFF');expect(canvasElementAppearance({...text,containerId:undefined},true).stroke).toBe('#000000');
 expect(text.stroke).toBe('#FFFFFF');
});


test('selection and connector UI use the active theme accent and panel on both canvas modes',async()=>{
 const {drawSelection,drawConnectorHandles,drawElementAnchors,getElementAnchors,setCanvasUiPalette}=await import('../draw/renderer.ts');
 const palette={accent:'#0e7490',panel:'#ffffff',accentInk:'#ffffff'};setCanvasUiPalette(palette);
 const shape={id:'shape',type:'rectangle',x:20,y:30,width:100,height:80,stroke:'#FFFFFF',strokeWidth:2,fill:'transparent',fillStyle:'none'};
 for(const light of [false,true]){
  const colors=[];const state={save(){},restore(){},stroke(){colors.push(this.strokeStyle);},strokeRect(){colors.push(this.strokeStyle);},fill(){colors.push(this.fillStyle);}};const ctx=new Proxy(state,{get:(o,k)=>k in o?o[k]:()=>{}});
  drawSelection(ctx,shape,1,[],light);drawConnectorHandles(ctx,shape,1,'right',light);drawElementAnchors(ctx,getElementAnchors(shape),'left',1,light);
  expect(colors).toContain(palette.accent);expect(colors).not.toContain(light?'#000000':'#FFFFFF');expect(colors.some(c=>/3b82f6|59, ?130|96, ?165/i.test(c))).toBe(false);
 }
 setCanvasUiPalette(null);
});


test('Claude keeps primary and selected controls readable in both modes and saves by its own name',()=>{
 expect(WORKSPACE_THEMES.find(theme=>theme.id==='claude').name).toBe('Claude');
 expect(WORKSPACE_THEMES.some(theme=>theme.id==='clay')).toBe(false);
 expect(workspacePalette('claude','light')).toMatchObject({background:'#faf9f5',ink:'#141413'});
 expect(workspacePalette('claude','dark')).toMatchObject({panel:'#262624',ink:'#faf9f5'});
 for(const mode of ['light','dark']){
  const ui=workspaceControlPalette(mode,'claude');expect(contrast(ui['active-ink'],ui.active)).toBeGreaterThanOrEqual(4.5);expect(contrast(ui['info-ink'],ui.info)).toBeGreaterThanOrEqual(4.5);
  const p=workspacePalette('claude',mode);expect(contrast(p.accentInk,p.accent)).toBeGreaterThanOrEqual(4.5);expect(contrast(p.muted,p.background)).toBeGreaterThanOrEqual(4.5);
  expect(workspaceThemeStyle('claude',mode,true)['--notes-bg']).toBe(p.background);
 }
 expect(normalizeWorkspaceThemes({canvas:'claude',notes:'claude'})).toEqual({canvas:'claude',notes:'claude'});
});

test('Saved Clay choices move to the Claude theme',()=>{
 expect(normalizeWorkspaceThemes({canvas:'clay',notes:'clay'})).toEqual({canvas:'claude',notes:'claude'});
});

test('Blossom and Neon replace Parchment and Citrus with their own accents, distinct from Claude',()=>{
 const names=WORKSPACE_THEMES.map(theme=>theme.name);
 expect(names).toEqual(expect.arrayContaining(['Blossom','Neon','Claude']));
 expect(names).not.toEqual(expect.arrayContaining(['Parchment']));expect(names).not.toContain('Citrus');
 for(const mode of ['light','dark']){
  const accents=['paper','citrus','claude'].map(id=>workspacePalette(id,mode).accent);
  expect(new Set(accents).size).toBe(3);
  for(const id of ['paper','citrus']){const p=workspacePalette(id,mode),ui=workspaceControlPalette(mode,id);
   expect(contrast(p.accentInk,p.accent)).toBeGreaterThanOrEqual(4.5);expect(contrast(p.muted,p.background)).toBeGreaterThanOrEqual(4.5);
   expect(contrast(ui['active-ink'],ui.active)).toBeGreaterThanOrEqual(4.5);expect(contrast(ui['info-ink'],ui.info)).toBeGreaterThanOrEqual(4.5);}
 }
});

// Hue of an accent in degrees, so two themes that share a colour family are caught even when their hex values differ.
function accentHue(hex){const [r,g,b]=[1,3,5].map(o=>parseInt(hex.slice(o,o+2),16)/255);const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;if(d<.04)return -1;const x=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;return (x*60+360)%360;}
test('every workspace theme has its own accent hue in both modes',()=>{
 for(const mode of ['light','dark']){
  const ids=WORKSPACE_THEMES.map(theme=>theme.id);
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
   // Whiteboard and Studio both use cobalt on purpose (DESIGN.md); every other pair must differ.
   if(['board','black'].includes(ids[i])&&['board','black'].includes(ids[j]))continue;
   const a=accentHue(workspacePalette(ids[i],mode).accent),b=accentHue(workspacePalette(ids[j],mode).accent);
   const gap=a<0||b<0?180:Math.min(Math.abs(a-b),360-Math.abs(a-b));
   expect({pair:`${ids[i]}/${ids[j]} ${mode}`,gap:gap>=15}).toEqual({pair:`${ids[i]}/${ids[j]} ${mode}`,gap:true});
  }
 }
});

test('a stale or unknown theme id falls back to a valid palette instead of throwing',()=>{
 for(const mode of ['light','dark']){
  expect(()=>workspaceControlPalette(mode,'clay')).not.toThrow();
  expect(workspaceControlPalette(mode,'clay')).toEqual(workspaceControlPalette(mode,'claude'));
  expect(()=>workspaceThemeStyle('nope',mode,true)).not.toThrow();
 }
});

test('canvas chrome falls back to plain black or white only when no theme palette is set',async()=>{
 const {uiAccent,uiFill,uiOnAccent,setCanvasUiPalette}=await import('../draw/renderer.ts');
 setCanvasUiPalette(null);
 expect([uiAccent(true),uiAccent(false),uiFill(true),uiFill(false),uiOnAccent(true),uiOnAccent(false)]).toEqual(['#000000','#FFFFFF','#FFFFFF','#000000','#FFFFFF','#000000']);
 setCanvasUiPalette({accent:'#a9502d',panel:'#ffffff',accentInk:'#ffffff'});
 expect([uiAccent(true),uiAccent(false),uiFill(true),uiFill(false)]).toEqual(['#a9502d','#a9502d','#ffffff','#ffffff']);
 setCanvasUiPalette(null);
});

test('every theme accent stays visible against its own canvas background in both modes',()=>{
 for(const {id} of WORKSPACE_THEMES)for(const mode of ['light','dark']){
  const p=workspacePalette(id,mode);
  expect({id,mode,ratio:contrast(p.accent,p.background)>=3}).toEqual({id,mode,ratio:true});
 }
});
