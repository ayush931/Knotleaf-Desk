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


test('selection and connector UI use contrasting monochrome ink on both canvas modes',async()=>{
 const {drawSelection,drawConnectorHandles,drawElementAnchors,getElementAnchors}=await import('../draw/renderer.ts');
 const shape={id:'shape',type:'rectangle',x:20,y:30,width:100,height:80,stroke:'#FFFFFF',strokeWidth:2,fill:'transparent',fillStyle:'none'};
 for(const light of [false,true]){
  const colors=[];const state={save(){},restore(){},stroke(){colors.push(this.strokeStyle);},strokeRect(){colors.push(this.strokeStyle);},fill(){colors.push(this.fillStyle);}};const ctx=new Proxy(state,{get:(o,k)=>k in o?o[k]:()=>{}});
  drawSelection(ctx,shape,1,[],light);drawConnectorHandles(ctx,shape,1,'right',light);drawElementAnchors(ctx,getElementAnchors(shape),'left',1,light);
  expect(colors).toContain(light?'#000000':'#FFFFFF');expect(colors.some(c=>/3b82f6|59, ?130|96, ?165/i.test(c))).toBe(false);
 }
});


test('Clay keeps primary and selected controls readable in both modes and saves by its own name',()=>{
 expect(WORKSPACE_THEMES.find(theme=>theme.id==='clay').name).toBe('Clay');
 for(const mode of ['light','dark']){
  const ui=workspaceControlPalette(mode,'clay');expect(contrast(ui['active-ink'],ui.active)).toBeGreaterThanOrEqual(4.5);expect(contrast(ui['info-ink'],ui.info)).toBeGreaterThanOrEqual(4.5);
  const p=workspacePalette('clay',mode);expect(workspaceThemeStyle('clay',mode,true)['--notes-bg']).toBe(p.background);
 }
 expect(normalizeWorkspaceThemes({canvas:'clay',notes:'clay'})).toEqual({canvas:'clay',notes:'clay'});
});
