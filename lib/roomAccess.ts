import { isRoomInviteId as isRoomBoardId } from "./roomInvites";
const PREFIX = "knotleaf.room-host.";
const memory = new Map<string, { token: string; expiresAt: number }>();
export function clearRoomHostAccess(id: string): void {
  memory.delete(id);
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {}
}
function valid(value: unknown): value is { token: string; expiresAt: number } {
  const data = value as { token?: unknown; expiresAt?: unknown };
  return (
    !!data &&
    typeof data.token === "string" &&
    /^[a-f0-9]{64}$/.test(data.token) &&
    typeof data.expiresAt === "number" &&
    Number.isFinite(data.expiresAt) &&
    data.expiresAt > Date.now()
  );
}
/** Host capability never enters the board, invite URL, collaboration document or export. */
export function saveRoomHostAccess(
  id: string,
  token: string,
  expiry: string,
): boolean {
  const entry = { token, expiresAt: Date.parse(expiry) };
  if (!isRoomBoardId(id) || !valid(entry)) return false;
  memory.set(id, entry);
  try {
    localStorage.setItem(PREFIX + id, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}
export function getRoomHostAccess(id: string): string | undefined {
  if (!isRoomBoardId(id)) return;
  const cached = memory.get(id);
  if (valid(cached)) return cached.token;
  memory.delete(id);
  try {
    const data = JSON.parse(localStorage.getItem(PREFIX + id) || "null");
    if (valid(data)) {
      memory.set(id, data);
      return data.token;
    }
    localStorage.removeItem(PREFIX + id);
  } catch {}
}
