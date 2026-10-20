import { brandAsset } from '@/lib/brandAssets';
import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest {
  return {id:'/',name:'Knotleaf Desk',short_name:'Knotleaf',description:'Canvas, notes and collaborative classrooms.',start_url:'/',scope:'/',display:'standalone',background_color:'#121212',theme_color:'#121212',icons:[{src:brandAsset('/icons/icon-192.png'),sizes:'192x192',type:'image/png',purpose:'any'},{src:brandAsset('/icons/icon-512.png'),sizes:'512x512',type:'image/png',purpose:'any'}]};
}
