import { frontendRoomStore, createFrontendRoom } from "@/server/frontend-rooms.mjs";
import { isValidElement } from "@/lib/elementValidation.mjs";
import { sharedElements } from '@/lib/localAssets.mjs';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const maxDuration = 60;
// Frontend and hub share durable room storage; proxy only when this frontend has no database.
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowed = new Set([request.nextUrl.origin]);
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try { allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin); } catch { /* Ignore invalid configuration. */ }
  }
  if (!origin || !allowed.has(origin)) return NextResponse.json({ error:'Create rooms from this website.' },{status:403});
  const endpoint = process.env.NEXT_PUBLIC_COLLAB_URL;
  if (!endpoint) return NextResponse.json({error:'Run bun dev/start for local sharing, or configure NEXT_PUBLIC_COLLAB_URL with your room server.'},{status:503});
  try {
    const url = new URL(endpoint);
    if (!['ws:','wss:'].includes(url.protocol)) throw new Error('Invalid room endpoint');
    url.protocol=url.protocol==='wss:'?'https:':'http:'; url.pathname='/api/rooms'; url.search=''; url.hash='';
    const raw = await request.text();
    if(Buffer.byteLength(raw)>6_000_000)return NextResponse.json({error:'Board is too large to share.'},{status:413});
    let parsed;try{parsed=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid board content.'},{status:400});}
    if(parsed?.warmup!==true&&(!parsed||typeof parsed.title!=='string'||!Array.isArray(parsed.elements)||!parsed.elements.every(isValidElement)||(parsed.markdownNotes!==undefined&&typeof parsed.markdownNotes!=='string')))return NextResponse.json({error:'Invalid board content.'},{status:400});
    if (Array.isArray(parsed?.elements)) parsed.elements = sharedElements(parsed.elements);
    const body = JSON.stringify(parsed); if (Buffer.byteLength(body)>6_000_000) return NextResponse.json({error:'Board is too large to share.'},{status:413});
    if(process.env.DATABASE_URL){
      const data=await createFrontendRoom(frontendRoomStore(process.env.DATABASE_URL),parsed,origin,endpoint);
      return NextResponse.json(data,{status:parsed.warmup===true?200:201,headers:{'Cache-Control':'no-store'}});
    }
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body,signal:AbortSignal.timeout(55000)});
    const data = await response.json().catch(() => null);
    if (!data) return NextResponse.json({error:'The room host is unavailable or starting up. Your board is safe; retry shortly.'},{status:503});
    return NextResponse.json(data && response.ok ? { ...data, websocketUrl: endpoint } : data,{status:response.status,headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const timedOut = error instanceof Error && ['TimeoutError','AbortError'].includes(error.name);
    return NextResponse.json({error:timedOut ? 'The room host took too long to respond. It may be starting up. Your board is safe; retry shortly.' : 'Could not reach the room server. Check its URL, allowed origins and storage.'},{status:503});
  }
}
