import { Board, BoardSummary, CanvasElement, Workspace } from "@/draw/types";
import { TEMPLATES } from "@/draw/templatesData";

const STORAGE_KEYS = {
  BOARDS_INDEX: "excali_eraser_boards_index",
  BOARD_PREFIX: "excali_eraser_board_",
  ACTIVE_ID: "excali_eraser_active_board_id",
};

export function getAllBoards(): BoardSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOARDS_INDEX);
    if (!raw) return [];
    return JSON.parse(raw);
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
    if (board) {
      board.theme = "dark";
      board.viewMode ||= "canvas";
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
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, board.id);
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
    title: title || "Untitled Whiteboard",
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
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
}

export function setActiveBoardId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, id);
}

export function getOrCreateDefaultBoard(): Board {
  const activeId = getActiveBoardId();
  if (activeId) {
    const board = getBoard(activeId);
    if (board) {
      return board;
    }
  }

  const all = getAllBoards();
  if (all.length > 0) {
    const first = getBoard(all[0].id);
    if (first) {
      setActiveBoardId(first.id);
      return first;
    }
  }

  // Create clean blank whiteboard (nothing in default, only clean white space)
  const initial = createBoard("Untitled Whiteboard");
  initial.elements = [];
  initial.markdownNotes = "";
  initial.theme = "dark";
  initial.viewMode = "canvas";
  saveBoard(initial);
  return initial;
}

export function exportBoardToJson(board: Board): string {
  return JSON.stringify(board, null, 2);
}

export function importBoardFromJson(jsonStr: string): Board | null {
  try {
    const parsed = JSON.parse(jsonStr) as Board;
    if (!parsed || !Array.isArray(parsed.elements) || parsed.elements.length > 10000 || !parsed.elements.every(isValidElement)) {
      throw new Error("Invalid board format");
    }
    parsed.createdAt = Number.isFinite(parsed.createdAt) ? parsed.createdAt : Date.now();
    parsed.markdownNotes = typeof parsed.markdownNotes === "string" ? parsed.markdownNotes : "";
    parsed.theme = "dark";
    parsed.viewMode = ["canvas", "split", "notes"].includes(parsed.viewMode) ? parsed.viewMode : "canvas";
    parsed.gridType = ["dot", "grid", "none"].includes(parsed.gridType) ? parsed.gridType : "dot";
    // Give unique ID on import to avoid collisions
    parsed.id = Math.random().toString(36).substring(2, 10);
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

export function isValidElement(value: unknown): value is CanvasElement {
  if (!value || typeof value !== "object") return false;
  const el = value as Record<string, unknown>;
  if (typeof el.id !== "string" || !["rectangle", "diamond", "circle", "arrow", "line", "pencil", "text", "sticky", "icon", "frame"].includes(String(el.type))) return false;
  if (!["x", "y", "width", "height", "strokeWidth", "opacity"].every(k => typeof el[k] === "number" && Number.isFinite(el[k]))) return false;
  if (!["stroke", "fill", "strokeStyle", "fillStyle", "roundness"].every(k => typeof el[k] === "string")) return false;
  if (el.type === "arrow" || el.type === "line") return ["startX", "startY", "endX", "endY"].every(k => typeof el[k] === "number" && Number.isFinite(el[k]));
  if (el.type === "pencil") return Array.isArray(el.points) && el.points.every(p => p && typeof p.x === "number" && Number.isFinite(p.x) && typeof p.y === "number" && Number.isFinite(p.y));
  if (el.type === "text" || el.type === "sticky") return typeof el.text === "string" && typeof el.fontSize === "number" && Number.isFinite(el.fontSize);
  if (el.type === "frame") return typeof el.title === "string";
  if (el.type === "icon") return typeof el.iconId === "string";
  return true;
}
