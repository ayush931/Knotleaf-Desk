'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Download,X} from 'lucide-react';
interface InstallPrompt extends Event {prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
export function InstallWebApp(){
  const prompt=useRef<InstallPrompt|null>(null),dialog=useRef<HTMLDialogElement>(null);
  const [installed,setInstalled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    const mode=window.matchMedia('(display-mode: standalone)');
    const update=()=>setInstalled(mode.matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
    const available=(event:Event)=>{event.preventDefault();prompt.current=event as InstallPrompt;};
    const complete=()=>{prompt.current=null;setInstalled(true);dialog.current?.close();};
    update();mode.addEventListener('change',update);window.addEventListener('beforeinstallprompt',available);window.addEventListener('appinstalled',complete);
    return()=>{mode.removeEventListener('change',update);window.removeEventListener('beforeinstallprompt',available);window.removeEventListener('appinstalled',complete);};
  },[]);
  const install=async()=>{
    if(busy)return;setError('');const event=prompt.current;
    if(!event){dialog.current?.showModal();return;}
    prompt.current=null;setBusy(true);
    try{await event.prompt();await event.userChoice;}catch{setError('Installation could not open. Use your browser menu or try again.');dialog.current?.showModal();}finally{setBusy(false);}
  };
  return <><button type="button" aria-label={installed?'Web app installed':'Install web app'} title={installed?'Opened as an installed web app':'Install web app'} disabled={installed||busy} onClick={()=>void install()} className="flex items-center gap-1 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-40"><Download className="h-4 w-4"/><span className="hidden xl:inline text-xs">{installed?'Installed':'Install'}</span></button>{typeof document!=='undefined'&&createPortal(<dialog ref={dialog} aria-labelledby="install-web-app-title" className="m-auto max-h-[90dvh] w-[min(420px,92vw)] overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-neutral-100 shadow-2xl"><div className="flex items-center justify-between"><h2 id="install-web-app-title" className="font-semibold">Install Knotleaf Desk</h2><button autoFocus type="button" aria-label="Close installation instructions" onClick={()=>dialog.current?.close()} className="note-tool"><X className="h-4 w-4"/></button></div><p className="my-3 text-sm text-neutral-400">Keep Knotleaf in its own window with an icon on your device.</p><ul className="space-y-3 text-sm text-neutral-300"><li><strong>Chrome / Edge:</strong> Open the browser menu and choose Install Knotleaf Desk, Install app, or Apps → Install this site as an app.</li><li><strong>iPhone / iPad:</strong> In Safari, tap Share → Add to Home Screen → Add.</li><li><strong>Safari on Mac:</strong> Choose File → Add to Dock.</li></ul><p className="mt-4 text-xs text-neutral-400">If your browser has no install option, open this website in a supported browser. Calls and shared rooms need internet. The app and its icon can update without reinstalling. Your browser may ask you to review an icon change in its app menu. Use Refresh in the app header to load the latest update without closing this window. Refresh reloads the window and ends active calls; stop and save recordings first.</p>{error&&<p role="alert" className="mt-3 text-xs text-blue-300">{error}</p>}</dialog>,document.body)}</>;
}
