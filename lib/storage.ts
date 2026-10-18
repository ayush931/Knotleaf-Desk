import { isValidElement } from "./elementValidation.mjs";
export { isValidElement } from "./elementValidation.mjs";
import { readProjectPayload } from "./projectFile";
import { normalizeBackground } from "./background.mjs";
import { Board, BoardSummary, CanvasElement, Workspace } from "@/draw/types";
import { TEMPLATES } from "@/draw/templatesData";
import { roomExpiresAt } from "./roomExpiry.mjs";

function expiredRoom(board: { id: string; createdAt: number; roomExpiresAt?: number }): boolean {
  return isRoomBoardId(board.id) && (board.roomExpiresAt ?? roomExpiresAt(board.createdAt)) <= Date.now();
}
function removeRoomCache(id: string) {
  localStorage.removeItem(`excali_eraser_board_${id}`);
  localStorage.removeItem(`knotleaf_history_${id}`);
  if (getActiveBoardId() === id) localStorage.removeItem('excali_eraser_active_board_id');
}

const STORAGE_KEYS = {
  BOARDS_INDEX: "excali_eraser_boards_index",
  BOARD_PREFIX: "excali_eraser_board_",
  ACTIVE_ID: "excali_eraser_active_board_id",
  PERSONAL_ID: "excali_eraser_personal_board_id",
};

export function getAllBoards(): BoardSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOARDS_INDEX);
    if (!raw) return [];
    const index: BoardSummary[] = JSON.parse(raw);
    const kept = index.filter(summary => {
      if (!isRoomBoardId(summary.id)) return true;
      const cached = localStorage.getItem(`${STORAGE_KEYS.BOARD_PREFIX}${summary.id}`);
      const board = cached ? JSON.parse(cached) : summary;
      if (!expiredRoom(board)) return true;
      removeRoomCache(summary.id); return false;
    });
    if (kept.length !== index.length) saveBoardsIndex(kept);
    return kept;
  } catch (err) {
    console.error("Failed to load boards from localStorage", err);
    return [];
  }
}

export function saveBoardsIndex(summaries: BoardSummary[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_KEYS.BOARDS_INDEX, JSON.stringify(summaries));
    return true;
  } catch (err) {
    console.error("Failed to save boards index", err);
    return false;
  }
}

export function getBoard(id: string): Board | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.BOARD_PREFIX}${id}`);
    if (!raw) return null;
    const board = JSON.parse(raw) as Board;
    if (board && expiredRoom(board)) { removeRoomCache(id); return null; }
    if (board) {
      board.theme = "dark";
      board.viewMode ||= "canvas";
      board.markdownNotes ??= "";
    }
    return board;
  } catch (err) {
    console.error(`Failed to load board ${id}`, err);
    return null;
  }
}

export function saveBoard(board: Board): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (expiredRoom(board)) { removeRoomCache(board.id); return false; }
    board.updatedAt = Date.now();
    localStorage.setItem(
      `${STORAGE_KEYS.BOARD_PREFIX}${board.id}`,
      JSON.stringify(board)
    );

    // Update index summary
    const index = getAllBoards();
    const existingIndex = index.findIndex((b) => b.id === board.id);
    const summary: BoardSummary = {
      workspaceId: board.workspaceId,
      id: board.id,
      title: board.title,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      elementCount: board.elements.length,
    };

    if (existingIndex >= 0) {
      index[existingIndex] = summary;
    } else {
      index.unshift(summary);
    }
    const indexed = saveBoardsIndex(index);
    setActiveBoardId(board.id);
    return indexed;
  } catch (err) {
    console.error("Failed to save board to localStorage", err);
    return false;
  }
}

export function createBoard(title?: string, templateId?: string, workspaceId = "personal", id = Math.random().toString(36).substring(2, 10)): Board {
  const now = Date.now();
  let elements: CanvasElement[] = [];
  let markdownNotes = "";

  if (templateId) {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      elements = JSON.parse(JSON.stringify(template.elements));
      markdownNotes = template.markdownNotes;
      if (!title) {
        title = template.name;
      }
    }
  }

  const newBoard: Board = {
    id,
    workspaceId,
    title: title || "Untitled board",
    elements,
    markdownNotes,
    createdAt: now,
    updatedAt: now,
    theme: "dark",
    viewMode: "canvas",
    gridType: "dot",
    snapToGrid: false,
    zoom: 1,
    panOffset: { x: 0, y: 0 },
  };

  saveBoard(newBoard);
  return newBoard;
}

export function clearBoard(id: string): Board | null {
  const board = getBoard(id);
  if (!board) return null;
  board.elements = [];
  board.markdownNotes = "";
  board.updatedAt = Date.now();
  saveBoard(board);
  return board;
}

export function deleteBoard(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${STORAGE_KEYS.BOARD_PREFIX}${id}`);
    localStorage.removeItem(`knotleaf_history_${id}`);
    const index = getAllBoards().filter((b) => b.id !== id);
    saveBoardsIndex(index);

    const activeId = getActiveBoardId();
    if (activeId === id) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
    }
  } catch (err) {
    console.error("Failed to delete board", err);
  }
}

export function duplicateBoard(id: string): Board | null {
  const source = getBoard(id);
  if (!source) return null;

  const clone: Board = {
    ...JSON.parse(JSON.stringify(source)),
    id: Math.random().toString(36).substring(2, 10),
    title: `${source.title} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveBoard(clone);
  return clone;
}

export function getActiveBoardId(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(STORAGE_KEYS.ACTIVE_ID); } catch { return null; }
}

export function setActiveBoardId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, id);
    if (!isRoomBoardId(id)) localStorage.setItem(STORAGE_KEYS.PERSONAL_ID, id);
  } catch { /* Saving the board reports storage failures; navigation remains usable. */ }
}

export function getOrCreateDefaultBoard(): Board {
  // A cached shared room must reopen via its room route, never as a personal board.
  return getOrCreatePersonalBoard();
}

export function exportBoardToJson(board: Board): string {
  return JSON.stringify(board, null, 2);
}

export function importBoardFromJson(jsonStr: string): Board | null {
  try {
    const parsed = readProjectPayload(jsonStr) as Board;
    if (!parsed || typeof parsed !== "object" || typeof parsed.title !== "string" || !Array.isArray(parsed.elements) || parsed.elements.length > 10000 || !parsed.elements.every(isValidElement)) {
      throw new Error("Invalid board format");
    }
    if (new Set(parsed.elements.map(el => el.id)).size !== parsed.elements.length) throw new Error("Duplicate element IDs in this backup.");
    parsed.createdAt = Number.isFinite(parsed.createdAt) ? parsed.createdAt : Date.now();
    parsed.markdownNotes = typeof parsed.markdownNotes === "string" ? parsed.markdownNotes : "";
    parsed.background = normalizeBackground(parsed.background);
    parsed.theme = "dark";
    parsed.viewMode = ["canvas", "split", "notes"].includes(parsed.viewMode) ? parsed.viewMode : "canvas";
    parsed.gridType = ["dot", "grid", "none"].includes(parsed.gridType) ? parsed.gridType : "dot";
    // Give unique ID on import to avoid collisions
    parsed.id = `import-${crypto.randomUUID()}`;
    parsed.workspaceId = "personal";
    parsed.snapToGrid = parsed.snapToGrid === true;
    parsed.zoom = Number.isFinite(parsed.zoom) ? Math.max(0.1, Math.min(4, parsed.zoom)) : 1;
    parsed.panOffset = parsed.panOffset && Number.isFinite(parsed.panOffset.x) && Number.isFinite(parsed.panOffset.y) ? parsed.panOffset : { x: 0, y: 0 };
    parsed.title = `${parsed.title || "Imported Board"} (Imported)`;
    parsed.updatedAt = Date.now();
    if (!saveBoard(parsed)) return null;
    return parsed;
  } catch (err) {
    console.error("Failed to parse board JSON", err);
    return null;
  }
}

const WORKSPACES_KEY = "excali_eraser_workspaces";
export function getWorkspaces(): Workspace[] {
  const personal = { id: "personal", name: "Personal workspace", createdAt: 0 };
  if (typeof window === "undefined") return [personal];
  try { return [personal, ...JSON.parse(localStorage.getItem(WORKSPACES_KEY) || "[]").filter((w: Workspace) => w.id !== "personal")]; }
  catch { return [personal]; }
}
export function createWorkspace(name: string): Workspace {
  const workspace = { id: crypto.randomUUID(), name: name.trim() || "Untitled workspace", createdAt: Date.now() };
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify([...getWorkspaces().filter(w => w.id !== "personal"), workspace]));
  return workspace;
}
export function moveBoardToWorkspace(id: string, workspaceId: string) {
  const board = getBoard(id);
  if (board) saveBoard({ ...board, workspaceId });
}



export function isRoomBoardId(id: string): boolean {
  return /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(id);
}
/** Return to personal work without deleting the room or its cached local copy. */
export function getOrCreatePersonalBoard(): Board {
  let lastId: string | null = null;
  try { if (typeof window !== "undefined") lastId = localStorage.getItem(STORAGE_KEYS.PERSONAL_ID); } catch { /* Browser storage can be unavailable. */ }
  const last = lastId && !isRoomBoardId(lastId) ? getBoard(lastId) : null;
  const board = last || getAllBoards().filter(summary => !isRoomBoardId(summary.id)).sort((a, b) => b.updatedAt - a.updatedAt).map(summary => getBoard(summary.id)).find((candidate): candidate is Board => candidate !== null) || createBoard();
  setActiveBoardId(board.id);
  return board;
}

/** Opens Markdown notes or a portable/legacy project as a new personal board. */
export function importBoardFile(text: string, filename = "backup.json"): Board | null {
  if (/\.(md|markdown)$/i.test(filename)) return importBoardFromJson(JSON.stringify({ title: filename.replace(/\.(md|markdown)$/i, ""), elements: [], markdownNotes: text.replace(/^\uFEFF/, ""), viewMode: "notes" }));
  return importBoardFromJson(text);
}
