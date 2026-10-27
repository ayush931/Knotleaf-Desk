"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { FileImportProgress, type ImportNotice } from './FileImportProgress';
import type { ImportOptions } from '@/lib/markdownFiles';
export interface FileImportHandle { start: (file: File) => Promise<void>; isBusy: () => boolean }
/** One import/progress owner for header and workspace; progress does not rerender the canvas. */
export const FileImportController=forwardRef<FileImportHandle,{onImport:(file:File,options:ImportOptions)=>Promise<void>}>(function FileImportController({onImport},ref){
 const controller=useRef<AbortController|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),mounted=useRef(true);
 const [notice,setNotice]=useState<ImportNotice|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();clearTimeout(timer.current);};},[]);
 const start=async(file:File)=>{
  if(controller.current)return;
  clearTimeout(timer.current);
  const active=new AbortController();controller.current=active;
  setNotice({name:file.name,state:'busy',phase:'Opening file',percent:0});
  try{
   await onImport(file,{signal:active.signal,onProgress:progress=>{if(mounted.current&&!active.signal.aborted)setNotice({name:file.name,state:'busy',...progress});}});
   if(!mounted.current)return;
   setNotice({name:file.name,state:'success',phase:'Opened on this device',percent:100});
   timer.current=setTimeout(()=>setNotice(null),2000);
  }catch(error){
   if(!mounted.current)return;
   const cancelled=active.signal.aborted&&!(error instanceof Error&&error.name==='ImportCleanupError');
   setNotice({name:file.name,state:cancelled?'cancelled':'error',phase:cancelled?'Import cancelled. Partial file data removed.':error instanceof Error?error.message:'Could not open this file.'});
  }finally{if(controller.current===active)controller.current=null;}
 };
 useImperativeHandle(ref,()=>({start,isBusy:()=>!!controller.current}));
 return <FileImportProgress notice={notice} onCancel={()=>{setNotice(previous=>previous?{...previous,phase:'Cancelling…'}:null);controller.current?.abort(new DOMException('Import cancelled','AbortError'));}} onDismiss={()=>{clearTimeout(timer.current);setNotice(null);}}/>;
});
