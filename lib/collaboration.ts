import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { isValidElement } from "./storage";
import type { Board, CanvasElement, Point } from "@/draw/types";

export interface Collaborator { id: number; name: string; color: string; cursor?: Point }
export function updateSharedText(text: Y.Text, next: string) {
  const current = text.toString();
  if (current === next) return;
  let start = 0;
  while (start < current.length && start < next.length && current[start] === next[start]) start++;
  let end = 0;
  while (end < current.length - start && end < next.length - start && current[current.length - 1 - end] === next[next.length - 1 - end]) end++;
  text.delete(start, current.length - start - end);
  const insertion = next.slice(start, next.length - end);
  if (insertion) text.insert(start, insertion);
}

export class RoomSession {
  readonly doc = new Y.Doc();
  readonly elements = this.doc.getMap<CanvasElement>("elements");
  readonly notes = this.doc.getText("notes");
  readonly meta = this.doc.getMap<string>("meta");
  readonly undo = new Y.UndoManager([this.elements, this.notes], { trackedOrigins: new Set([this]), captureTimeout: 300 });
  readonly provider: WebsocketProvider;
  synced = false;
  private queued: Board | undefined;
  onRemote?: (elements: CanvasElement[], notes: string, title: string) => void;
  onStatus?: (status: string) => void;
  onPresence?: (people: Collaborator[]) => void;
  onHistory?: (canUndo: boolean, canRedo: boolean) => void;
  constructor(url: string, roomId: string, seed?: Board) {
    this.queued = seed;
    this.provider = new WebsocketProvider(url, roomId, this.doc, { connect: false });
    const colors = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#c084fc"];
    this.provider.awareness.setLocalStateField("user", { name: `Guest ${String(this.doc.clientID).slice(-4)}`, color: colors[this.doc.clientID % colors.length] });
    this.provider.on("status", ({ status }: { status: string }) => this.onStatus?.(status));
    this.provider.on("sync", (synced: boolean) => {
      if (!synced) return; // Keep an initialized document writable during reconnects.
      this.synced = true;
      if (!this.meta.has("initialized")) {
        const initial = this.queued;
        this.doc.transact(() => {
          this.meta.set("initialized", "true");
          this.meta.set("title", initial?.title || "Shared whiteboard");
          initial?.elements.forEach(el => this.elements.set(el.id, structuredClone(el)));
          if (initial?.markdownNotes) this.notes.insert(0, initial.markdownNotes);
        }, "seed");
      }
      this.queued = undefined;
      this.emitRemote();
    });
    this.doc.on("afterTransaction", (transaction: Y.Transaction) => {
      if (this.synced && transaction.origin !== this && transaction.changed.size) this.emitRemote();
      this.onHistory?.(this.undo.undoStack.length > 0, this.undo.redoStack.length > 0);
    });
    this.provider.awareness.on("change", () => {
      const people: Collaborator[] = [];
      this.provider.awareness.getStates().forEach((state, id) => {
        if (!state.user || typeof state.user.name !== "string") return;
        const cursor = state.cursor && Number.isFinite(state.cursor.x) && Number.isFinite(state.cursor.y) ? state.cursor : undefined;
        people.push({ id, name: state.user.name.slice(0, 40), color: /^#[a-f\d]{6}$/i.test(state.user.color) ? state.user.color : "#60a5fa", cursor: id === this.doc.clientID ? undefined : cursor });
      });
      this.onPresence?.(people);
    });
  }
  connect() { this.provider.connect(); }
  update(board: Board) {
    if (!this.synced) { this.queued = board; return; }
    this.doc.transact(() => {
      const ids = new Set(board.elements.map(el => el.id));
      this.elements.forEach((_, id) => { if (!ids.has(id)) this.elements.delete(id); });
      for (const el of board.elements) if (JSON.stringify(this.elements.get(el.id)) !== JSON.stringify(el)) this.elements.set(el.id, structuredClone(el));
      updateSharedText(this.notes, board.markdownNotes || "");
      if (this.meta.get("title") !== board.title) this.meta.set("title", board.title);
    }, this);
  }
  private emitRemote() { this.onRemote?.([...this.elements.values()].filter(isValidElement).sort((a, b) => a.zIndex - b.zIndex), this.notes.toString(), this.meta.get("title") || "Shared whiteboard"); }
  cursor(point: Point | null) { this.provider.awareness.setLocalStateField("cursor", point); }
  setName(name: string) { const user = this.provider.awareness.getLocalState()?.user; this.provider.awareness.setLocalStateField("user", { ...user, name: name.trim().slice(0, 40) || "Guest" }); }
  destroy() { this.provider.destroy(); this.undo.destroy(); this.doc.destroy(); }
}
