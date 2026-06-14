"use client";

import { WS_URL } from "@/app/config";
import { useEffect, useState } from "react";
import { Canvas } from "./Canvas";
import { useRouter } from "next/navigation";

export function RoomCanvas({ roomId }: { roomId: string }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signin");
      return;
    }

    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      setSocket(ws);
      ws.send(
        JSON.stringify({
          type: "join_room",
          roomId,
        }),
      );
    };

    ws.onerror = (err) => {
      console.error("WebSocket connection error:", err);
      setError("Failed to establish real-time connection. Please try again.");
    };

    ws.onclose = () => {
      setSocket(null);
    };

    return () => {
      ws.close();
    };
  }, [roomId, router]);

  if (error) {
    return (
      <div className="w-screen h-screen flex flex-col justify-center items-center bg-neutral-950 text-white gap-4">
        <p className="text-rose-500 font-medium text-lg">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition duration-200 shadow-lg shadow-blue-500/20"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!socket) {
    return (
      <div className="w-screen h-screen flex flex-col justify-center items-center bg-neutral-950 text-white gap-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-neutral-400 font-medium tracking-wide animate-pulse">
          Connecting to session...
        </p>
      </div>
    );
  }

  return (
    <div>
      <Canvas roomId={roomId} socket={socket} />
    </div>
  );
}
