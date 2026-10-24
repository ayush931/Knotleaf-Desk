import { authConfiguration } from '@/server/auth.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  const { enabled, google } = authConfiguration();
  return Response.json({ enabled, google }, { headers: { 'Cache-Control': 'no-store' } });
}
