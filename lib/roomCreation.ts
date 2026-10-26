import { saveRoomHostAccess } from "./roomAccess";
import { rememberCreatedRoom, rememberRoomServerUrl } from "./roomConnection";
import { isLocalAsset, sharedElements } from "./localAssets.mjs";
import type { Board } from "@/draw/types";
import { isRoomBoardId, saveBoard } from "./storage";

export async function createRoomFromBoard(
  board: Board,
): Promise<{ id: string; savedLocally: boolean }> {
  // Copy editable data once; keep immutable local file bytes out of deep cloning and the request.
  board = {
    ...board,
    elements: board.elements.map((element) =>
      isLocalAsset(element) ? { ...element } : structuredClone(element),
    ),
  };
  let response: Response;
  try {
    response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: board.title,
        elements: sharedElements(board.elements),
        markdownNotes: board.markdownNotes ?? "",
        background: board.background,
      }),
      signal: AbortSignal.timeout(65000),
    });
  } catch {
    throw new Error(
      "Could not reach the room server. Your personal board is safe. Check your connection and retry.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "The room server is unavailable. Your personal board is safe; retry shortly.",
    );
  if (!data || !isRoomBoardId(data.id) || typeof data.title !== "string")
    throw new Error(
      "The room server returned an invalid invite. Your personal board is safe; retry.",
    );
  if (typeof data.hostToken === "string" && typeof data.expiresAt === "string")
    saveRoomHostAccess(data.id, data.hostToken, data.expiresAt);
  rememberCreatedRoom(data.id, data.expiresAt);
  if (typeof data.websocketUrl === "string") {
    try {
      rememberRoomServerUrl(data.websocketUrl);
    } catch {
      /* Resolve configuration normally if the hint is invalid. */
    }
  }
  const savedLocally = saveBoard({
    ...board,
    markdownNotes: board.markdownNotes ?? "",
    id: data.id,
    title: data.title,
    createdAt: Date.now(),
    roomExpiresAt: data.expiresAt ? Date.parse(data.expiresAt) : undefined,
  });
  return { id: data.id, savedLocally };
}

// Background/intent warmup: no room is created, no board data is sent, and no polling keeps a host awake.
let warming:
  { origin: string; until: number; promise: Promise<void> } | undefined;
export function warmRoomServer(): Promise<void> {
  const origin = window.location.origin;
  if (warming?.origin === origin && warming.until > Date.now())
    return warming.promise;
  const entry = {
    origin,
    until: Infinity,
    promise: Promise.resolve(),
  };
  entry.promise = fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ warmup: true }),
    signal: AbortSignal.timeout(60000),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("Room warmup unavailable");
      const data = await response.json();
      entry.until = Date.now() + 60000;
      if (window.location.origin !== origin) return;
      if (typeof data.websocketUrl === "string")
        rememberRoomServerUrl(data.websocketUrl);
    })
    .catch(() => {
      if (warming === entry) warming = undefined;
    });
  warming = entry;
  return entry.promise;
}

/** Warm once after the personal workspace paints; never keep a sleeping host alive with polling. */
export function scheduleRoomWarmup(): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(() => { void warmRoomServer(); }, { timeout: 1000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(() => { void warmRoomServer(); }, 1000);
  return () => window.clearTimeout(id);
}
