export const dynamic = 'force-dynamic';
export function GET() {
  // The custom web server intercepts this route when it owns the WebSocket hub.
  // Serverless Next deployments need an explicitly hosted collaboration endpoint.
  return Response.json({
    collaboration: Boolean(process.env.NEXT_PUBLIC_COLLAB_URL),
    websocketUrl: process.env.NEXT_PUBLIC_COLLAB_URL || null,
    message: "This deployment needs a hosted room server. Set NEXT_PUBLIC_COLLAB_URL to its wss:// address and rebuild, or self-host with bun start.",
  }, { headers: { "Cache-Control": "no-store" } });
}
