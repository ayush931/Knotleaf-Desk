"use client";

import dynamic from "next/dynamic";

// The board lives in localStorage, so it can only render on the client.
const Canvas = dynamic(() => import("./Canvas").then((m) => m.Canvas), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-[100dvh] flex items-center justify-center bg-[#121212] text-neutral-400 text-sm">
      Loading whiteboard…
    </div>
  ),
});

export function CanvasApp({ roomId }: { roomId?: string }) {
  return <Canvas key={roomId || "personal"} initialRoomId={roomId} />;
}
