// Reversible UUID encoding: shorter links retain the full random room capability.
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
export function shortRoomCode(id:string):string {
  if(!UUID.test(id))throw new Error('Invalid room ID');
  const bytes=id.replace(/-/g,'').match(/../g)!.map(byte=>parseInt(byte,16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function roomIdFromCode(code:string):string|null {
  if(!/^[A-Za-z0-9_-]{22}$/.test(code))return null;
  try{
    const hex=Array.from(atob(code.replace(/-/g,'+').replace(/_/g,'/')+'=='),byte=>byte.charCodeAt(0).toString(16).padStart(2,'0')).join('');
    const id=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    return UUID.test(id)&&shortRoomCode(id)===code?id:null;
  }catch{return null;}
}
