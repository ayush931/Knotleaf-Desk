import { useEffect, useState } from "react";
import { WS_URL } from "../config";

export function useSocket() {
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<WebSocket>();

  useEffect(() => {
    const ws = new WebSocket(
      `${WS_URL}?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWh0NWI3YTcwMDAwanhiNzllajhldjUwIiwiaWF0IjoxNzYyODU0ODc1fQ.I-41wJnS5J1K9oUYO02GS_Khhtzzqsz1gWRSWuKS9sg`,
    ); // TODO:add the token
    ws.onopen = () => {
      setLoading(false);
      setSocket(ws);
    };
  }, []);

  return {
    loading,
    socket,
  };
}
