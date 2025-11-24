'use client';

import { WS_URL } from "@/app/config";
import { useEffect, useState } from "react";
import { Canvas } from "./Canvas";

export function RoomCanvas({ roomId }: { roomId: string }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWh0NWI3YTcwMDAwanhiNzllajhldjUwIiwiaWF0IjoxNzYzNzk3MDQzfQ.hyz3vW85gQ_McI2WTR5p3_jHGP3rsEQkFCmtaQX5REc`);

    ws.onopen = () => {
      setSocket(ws);
      ws.send(JSON.stringify({
        type: 'join_room',
        roomId
      }))
    }
  }, []);

  if (!socket) {
    return (
      <div>
        Connecting to server...
      </div>
    )
  }

  return (
    <div>
      <Canvas roomId={roomId} socket={socket} />
    </div>
  )
}
