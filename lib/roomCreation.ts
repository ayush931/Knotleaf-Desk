import { sharedElements } from "./localAssets.mjs";
import type { Board } from "@/draw/types";
import { isRoomBoardId, saveBoard } from "./storage";

export async function createRoomFromBoard(board: Board): Promise<{ id: string; savedLocally: boolean }> {
  let response: Response;
  try {
    response = await fetch("/api/rooms", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...board, elements: sharedElements(board.elements), markdownNotes: board.markdownNotes ?? "" }),
      signal: AbortSignal.timeout(65000),
    });
  } catch {
    throw new Error("Could not reach the room server. Your personal board is safe. Check your connection and retry.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "The room server is unavailable. Your personal board is safe; retry shortly.");
  if (!data || !isRoomBoardId(data.id) || typeof data.title !== "string") throw new Error("The room server returned an invalid invite. Your personal board is safe; retry.");
  const savedLocally = saveBoard({ ...board, markdownNotes: board.markdownNotes ?? "", id: data.id, title: data.title, createdAt: Date.now(), roomExpiresAt: data.expiresAt ? Date.parse(data.expiresAt) : undefined });
  return { id: data.id, savedLocally };
}
