import { CHAT_LIMIT, CHAT_TEXT_LIMIT, isRoomMessage, type RoomMessage } from "./roomChat";
import { normalizeBackground } from "./background.mjs";
import type { BackgroundSettings } from "@/draw/types";
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
  readonly chat = this.doc.getArray<RoomMessage>("chat");
  private sentChatAt: number[] = [];
  readonly notes = this.doc.getText("notes");
  readonly meta = this.doc.getMap<string>("meta");
  readonly undo = new Y.UndoManager([this.elements, this.notes, this.meta], { trackedOrigins: new Set([this]), captureTimeout: 300 });
  readonly provider: WebsocketProvider;
  synced = false;
  private destroyed = false;
  private expiryTimer?: ReturnType<typeof setTimeout>;
  private expired = false;
  expiresAt?: number;
  private queued: Board | undefined;
  private lastScene = new Map<string, CanvasElement>();
  private knownElementIds = new Set<string>();
  onChat?: (messages: RoomMessage[]) => void;
  onRemote?: (elements: CanvasElement[], notes: string, title: string, background: BackgroundSettings) => void;
  onStatus?: (status: string) => void;
  onPresence?: (people: Collaborator[]) => void;
  onHistory?: (canUndo: boolean, canRedo: boolean) => void;
  onExpired?: () => void;
  constructor(url: string, roomId: string, seed?: Board) {
    this.queued = seed;
    this.provider = new WebsocketProvider(url, roomId, this.doc, { connect: false });
    const colors = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#c084fc"];
    this.provider.awareness.setLocalStateField("user", { name: `Guest ${String(this.doc.clientID).slice(-4)}`, color: colors[this.doc.clientID % colors.length] });
    this.provider.on("status", ({ status }: { status: string }) => this.onStatus?.(status));
    this.provider.on("connection-close", (event: CloseEvent | null) => { if (event?.code === 4001) this.expire(); });
    this.provider.on("sync", (synced: boolean) => {
      if (!synced) return; // Keep an initialized document writable during reconnects.
      const expiry = Date.parse(this.meta.get("expiresAt") || "");
      if (Number.isFinite(expiry)) {
        this.expiresAt = expiry; clearTimeout(this.expiryTimer);
        if (expiry <= Date.now()) { this.expire(); return; }
        this.expiryTimer = setTimeout(() => this.expire(), Math.min(24 * 60 * 60 * 1000, expiry - Date.now()));
      }
      this.synced = true;
      if (!this.meta.has("initialized")) {
        const initial = this.queued;
        this.doc.transact(() => {
          this.meta.set("initialized", "true");
          this.meta.set("title", initial?.title || "Shared whiteboard");
          this.meta.set("background", JSON.stringify(normalizeBackground(initial?.background)));
          initial?.elements.forEach(el => {
            if (el.type === "text" && el.isCodeCard) { const code = this.doc.getText(`code:${el.id}`); code.insert(0, el.text); this.undo.addToScope(code); this.elements.set(el.id, { ...structuredClone(el), text: "" }); }
            else this.elements.set(el.id, structuredClone(el));
          });
          if (initial?.markdownNotes) this.notes.insert(0, initial.markdownNotes);
        }, "seed");
      }
      this.queued = undefined;
      this.emitRemote(); this.emitChat();
    });
    this.chat.observe(() => this.emitChat());
    this.doc.on("afterTransaction", (transaction: Y.Transaction) => {
      if (this.synced && transaction.origin !== this && transaction.changed.size && !(transaction.changed.size === 1 && transaction.changed.has(this.chat))) this.emitRemote();
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
  private expire() {
    if (this.expired || this.destroyed) return;
    this.expired = true; this.synced = false; clearTimeout(this.expiryTimer);
    this.provider.disconnect(); this.onExpired?.();
  }
  update(board: Board) {
    if (this.expired) return;
    if (!this.synced) { this.queued = board; return; }
    this.doc.transact(() => {
      // Publish only this client's edits, never replace the room with a full snapshot.
      // An unchanged stale shape must not resurrect a peer's deletion, and a missing
      // unseen shape must not erase a peer's concurrent addition.
      const local = new Map(board.elements.map(el => [el.id, el]));
      for (const id of this.lastScene.keys()) if (!local.has(id)) this.elements.delete(id);
      for (const el of board.elements) {
        const previous = this.lastScene.get(el.id);
        if (JSON.stringify(previous) === JSON.stringify(el)) continue;
        if ((previous || this.knownElementIds.has(el.id)) && !this.elements.has(el.id)) continue; // Remote deletion wins over a stale edit.
        if (el.type === "text" && el.isCodeCard) {
          const code = this.doc.getText(`code:${el.id}`); this.undo.addToScope(code);
          updateSharedText(code, el.text);
          const metadata = { ...structuredClone(el), text: "" };
          if (JSON.stringify(this.elements.get(el.id)) !== JSON.stringify(metadata)) this.elements.set(el.id, metadata);
        } else this.elements.set(el.id, structuredClone(el));
      }
      updateSharedText(this.notes, board.markdownNotes || "");
      const background = JSON.stringify(normalizeBackground(board.background));
      if (this.meta.get("background") !== background) this.meta.set("background", background);
      if (this.meta.get("title") !== board.title) this.meta.set("title", board.title);
    }, this);
    this.emitRemote();
  }
  private emitRemote() {
    const elements = [...this.elements.values()].filter(isValidElement).map(el => {
      if (el.type !== "text" || !el.isCodeCard) return el;
      const code = this.doc.getText(`code:${el.id}`); this.undo.addToScope(code);
      return { ...el, text: code.toString() || el.text };
    }).sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
    for (const el of elements) this.knownElementIds.add(el.id);
    this.lastScene = new Map(elements.map(el => [el.id, structuredClone(el)]));
    this.onRemote?.(elements, this.notes.toString(), this.meta.get("title") || "Shared whiteboard", normalizeBackground(this.meta.get("background")));
  }

  private emitChat() {
    const messages = this.chat.toArray().filter(isRoomMessage).slice(-CHAT_LIMIT);
    this.onChat?.(messages);
  }
  sendChat(text: string) {
    if (this.destroyed || this.expired || !this.synced || !this.provider.wsconnected) throw new Error("Chat is disconnected. Wait for the room to reconnect, then send again.");
    const content = text.trim();
    if (!content) return;
    if (content.length > CHAT_TEXT_LIMIT) throw new Error(`Messages can contain up to ${CHAT_TEXT_LIMIT} characters.`);
    const now = Date.now();
    this.sentChatAt = this.sentChatAt.filter(at => now - at < 10000);
    if (this.sentChatAt.length >= 10) throw new Error("You’re sending messages quickly. Wait a few seconds and try again.");
    const user = this.provider.awareness.getLocalState()?.user;
    const message: RoomMessage = { id: crypto.randomUUID(), author: this.doc.clientID, name: String(user?.name || "Guest").slice(0, 40), text: content, at: now };
    this.doc.transact(() => {
      if (this.chat.length >= CHAT_LIMIT) this.chat.delete(0, this.chat.length - CHAT_LIMIT + 1);
      this.chat.push([message]);
    }, "room-chat");
    this.sentChatAt.push(now);
  }
  cursor(point: Point | null) { this.provider.awareness.setLocalStateField("cursor", point); }
  setName(name: string) { const user = this.provider.awareness.getLocalState()?.user; this.provider.awareness.setLocalStateField("user", { ...user, name: name.trim().slice(0, 40) || "Guest" }); }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    clearTimeout(this.expiryTimer);
    this.provider.awareness.setLocalState(null);
    this.onRemote = undefined; this.onStatus = undefined; this.onPresence = undefined; this.onHistory = undefined; this.onExpired = undefined; this.onChat = undefined;
    this.provider.destroy(); this.undo.destroy(); this.doc.destroy();
  }
}
