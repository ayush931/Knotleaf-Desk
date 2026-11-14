"use client";

import dynamic from "next/dynamic";

// The board lives in localStorage, so it can only render on the client.
const Canvas = dynamic(() => import("./Canvas").then((m) => m.Canvas), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-dvh flex items-center justify-center bg-white dark:bg-black text-neutral-400 text-sm">
      Loading Knotleaf Desk…
    </div>
  ),
});

export function CanvasApp({ roomId }: { roomId?: string }) {
  return <Canvas key={roomId || "personal"} initialRoomId={roomId} />;
}
