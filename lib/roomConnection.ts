/** Resolve at runtime: a local server may serve a build made for the hosted website. */
export async function getRoomServerUrl(signal?: AbortSignal): Promise<string> {
  const timeout = AbortSignal.timeout(15000);
  const response = await fetch("/api/collaboration-health", { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  const config = await response.json();
  if (!response.ok || !config.collaboration || typeof config.websocketUrl !== "string") {
    throw new Error(config.message || "Room sharing is unavailable. Start the local server or check the hosted room server configuration.");
  }
  const url = new URL(config.websocketUrl, window.location.origin);
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  if (!["ws:", "wss:"].includes(url.protocol)) throw new Error("The room server URL is invalid.");
  return url.toString().replace(/\/$/, "");
}

export function roomInviteUrl(roomId: string, classroom = false): string {
  return `${window.location.origin}/canvas/${encodeURIComponent(roomId)}${classroom ? "?classroom=1" : ""}`;
}

export class RoomExpiredError extends Error {}
export async function checkRoomAvailable(serverUrl: string, roomId: string, signal?: AbortSignal): Promise<void> {
  const url = new URL(serverUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = `/api/rooms/${encodeURIComponent(roomId)}`; url.search = "";
  const timeout = AbortSignal.timeout(60000);
  const response = await fetch(url, { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (response.status === 404 || response.status === 410) throw new RoomExpiredError("This room expired or no longer exists.");
  if (!response.ok) throw new Error("Could not check the room server. Retry shortly.");
}
