"use client";

import { CanvasApp } from "./CanvasApp";

export function RoomCanvas({ roomId }: { roomId: string }) {
  return <CanvasApp roomId={roomId} />;
}
