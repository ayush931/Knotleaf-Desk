import { getDeskAuth } from '@/server/auth.mjs';
import { authFailureCode } from '@/server/auth-errors.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  try {
    const { auth } = await getDeskAuth();
    const response = await auth.handler(request);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    const code = authFailureCode(error);
    const requestId = crypto.randomUUID();
    console.error("Authentication request failed", { code, requestId });
    return Response.json({ code, requestId, message: 'Sign-in is unavailable. Please try again later.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
export const GET = handle;
export const POST = handle;
