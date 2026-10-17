import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
// The Node hub owns durable room creation. Serverless frontends proxy to it.
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error:'Create rooms from this website.' },{status:403});
  const endpoint = process.env.NEXT_PUBLIC_COLLAB_URL;
  if (!endpoint) return NextResponse.json({error:'Run bun dev/start for local sharing, or configure NEXT_PUBLIC_COLLAB_URL with your room server.'},{status:503});
  try {
    const url = new URL(endpoint); url.protocol=url.protocol==='wss:'?'https:':'http:'; url.pathname='/api/rooms'; url.search='';
    const body = await request.text(); if (Buffer.byteLength(body)>6_000_000) return NextResponse.json({error:'Board is too large to share.'},{status:413});
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:request.nextUrl.origin},body,signal:AbortSignal.timeout(15000)});
    return NextResponse.json(await response.json(),{status:response.status,headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'Could not reach the room server. Check its URL, allowed origins and storage.'},{status:503}); }
}
