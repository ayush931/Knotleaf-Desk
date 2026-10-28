import { createRoomStore } from './database.mjs';
import { createStoredRoom } from './room-http.mjs';
let cached;
/** One pool per warm frontend instance; the hub reads the same durable room rows. */
export function frontendRoomStore(connectionString) {
  if(!connectionString)throw new Error('Room storage is not configured');
  if(!cached||cached.connectionString!==connectionString)cached={connectionString,store:createRoomStore(connectionString)};
  return cached.store;
}
export async function createFrontendRoom(store,board,origin,websocketUrl) {
  if(board?.warmup===true){await store.ready?.();return {ready:true,websocketUrl,wakeRoomServer:true};}
  return {...await createStoredRoom(store,board,origin),websocketUrl,wakeRoomServer:true};
}
