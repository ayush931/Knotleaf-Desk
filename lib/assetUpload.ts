import type { AttachmentData } from '@/draw/types';
import { isValidAttachment } from './attachments.mjs';
import { getImageResource } from '@/draw/imageResource';
export type PreparedAsset = { kind:'image'; source:string; width:number; height:number; name:string } | {kind:'attachment'; attachment:AttachmentData};
function readData(file: Blob): Promise<string> {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('Could not read this file.'));reader.onerror=()=>reject(new Error('Could not read this file. Try selecting it again.'));reader.onabort=()=>reject(new Error('File upload cancelled.'));reader.readAsDataURL(file);});
}
export async function prepareAssets(files: File[]): Promise<PreparedAsset[]> {
  if (!files.length) return [];
  const assets:PreparedAsset[]=[];
  for(const file of files){
    const name=file.name.replace(/[\x00-\x1f\\/]/g,'-').trim().slice(0,180)||'Attachment';
    const mime=/^image\/(png|jpeg|webp)$/i.test(file.type)?file.type.toLowerCase():file.type?'':/\.(png|jpe?g|webp)$/i.test(name)?`image/${/\.png$/i.test(name)?'png':/\.webp$/i.test(name)?'webp':'jpeg'}`:'';
    if(mime){
      try {
      const source=await readData(new Blob([file],{type:mime}));
      const resource=getImageResource(source,undefined,Infinity);await resource.loaded;
      const {naturalWidth:width,naturalHeight:height}=resource.image;
      if(!width||!height)throw new Error(`${name} could not be decoded.`);
      assets.push({kind:'image',source,width,height,name});continue;
      } catch { /* Files without a usable image preview remain downloadable. */ }
    }
    {
      const attachment={name,size:file.size,mimeType:/^[\w.+-]+\/[\w.+-]+$/.test(file.type)?file.type:'application/octet-stream',source:await readData(new Blob([file],{type:'application/octet-stream'}))};
      if(!isValidAttachment(attachment))throw new Error(`${name} could not be attached. Try selecting the original file again.`);
      assets.push({kind:'attachment',attachment});
    }
  }
  return assets;
}
export function downloadAttachment(attachment:AttachmentData){
  if(!isValidAttachment(attachment))throw new Error('This attachment is invalid. Try uploading the original file again.');
  const binary=atob(attachment.source.slice(attachment.source.indexOf(',')+1)),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
  const link=document.createElement('a');link.href=url;link.download=attachment.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}