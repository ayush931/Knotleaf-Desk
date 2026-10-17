import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const maxDuration = 60;
// The Node hub owns durable room creation. Serverless frontends proxy to it.
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
    const body = await request.text(); if (Buffer.byteLength(body)>6_000_000) return NextResponse.json({error:'Board is too large to share.'},{status:413});
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body,signal:AbortSignal.timeout(55000)});
    const data = await response.json().catch(() => null);
    if (!data) return NextResponse.json({error:'The room host is unavailable or starting up. Your board is safe; retry shortly.'},{status:503});
    return NextResponse.json(data,{status:response.status,headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const timedOut = error instanceof Error && ['TimeoutError','AbortError'].includes(error.name);
    return NextResponse.json({error:timedOut ? 'The room host took too long to respond. It may be starting up. Your board is safe; retry shortly.' : 'Could not reach the room server. Check its URL, allowed origins and storage.'},{status:503});
  }
}
