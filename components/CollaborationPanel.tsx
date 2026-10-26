"use client";
import { warmRoomServer } from "@/lib/roomCreation";
import { useEffect, useRef, useState } from "react";
import { Users, Link, X, LogOut, MessageCircle } from "lucide-react";
import { RoomJoinForm } from "./RoomJoinForm";
import { RoomChat } from "./RoomChat";
import type { RoomChatProps } from "@/lib/roomChat";
import type { Collaborator } from "@/lib/collaboration";
import { roomInviteUrl } from "@/lib/roomConnection";
interface Props { roomChat?: RoomChatProps; roomId?: string; status: string; people: Collaborator[]; onCreate: () => Promise<void>; onJoin: (id: string, openCall?: boolean) => void; onName: (name: string) => void; onLeave: () => void }
export function CollaborationPanel(p: Props) {
  const [open, setOpen] = useState(false), [error, setError] = useState(""), [copied, setCopied] = useState(false);
  const [chatIntent, setChatIntent] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open && !p.roomId) void warmRoomServer(); }, [open, p.roomId]);
  const inviteLink = p.roomId && typeof window !== "undefined" ? roomInviteUrl(p.roomId) : "";
  const leaveRoom = () => { setOpen(false); p.onLeave(); };
  const [creating, setCreating] = useState(false);
  const createRoom = async () => {
    if (creating) return;
    setCreating(true); setError("");
    try {
      await p.onCreate();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not reach the room server."); }
    finally { setCreating(false); }
  };
  useEffect(() => { if (open) { dialog.current?.showModal(); if (chatIntent) dialog.current?.querySelector<HTMLTextAreaElement>('[aria-label="Room chat message"]')?.focus(); } else dialog.current?.close(); }, [open, chatIntent]);
  return <><button onPointerEnter={() => { if (!p.roomId) void warmRoomServer(); }} onFocus={() => { if (!p.roomId) void warmRoomServer(); }} onClick={() => { setChatIntent(false); setOpen(true); }} title="Collaboration rooms" aria-label="Open collaboration" className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10"><Users className="h-4 w-4" /><span className="hidden md:inline">{p.roomId ? `${p.people.length || 1} in room` : "Share"}</span></button>
    {p.roomId && p.roomChat && <button type="button" aria-label="Open room chat" title="Room chat · also available during calls" onClick={() => { setChatIntent(true); setOpen(true); }} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10"><MessageCircle className="h-4 w-4"/><span className="xl:hidden 2xl:inline">Chat</span></button>}
    {p.roomId && <button onClick={leaveRoom} aria-label="Leave room" title="Leave room and return to personal boards" className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Leave room</span></button>}
    <dialog ref={dialog} aria-labelledby="room-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} className="m-auto max-h-[90dvh] w-[min(440px,92vw)] overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-neutral-100 shadow-2xl">
      <div className="flex items-center justify-between"><h2 id="room-title" className="font-semibold">Collaborate in a room</h2><button autoFocus aria-label="Close collaboration" onClick={() => setOpen(false)} className="note-tool"><X className="h-4 w-4" /></button></div>
      {p.roomId ? <div className="mt-4 space-y-3"><p role="status" className={`text-sm ${p.status === "connected" ? "text-emerald-400" : "text-amber-400"}`}>{p.status === "connected" ? "Connected · edits merge live" : p.status === "expired" ? "Room expired · deleted after 24 hours" : "Connecting… check the collaboration server"}</p><label className="block text-xs text-neutral-400">Your name<input maxLength={40} placeholder="Your name" onChange={e => p.onName(e.target.value)} className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white" /></label><button onClick={async () => { try { await navigator.clipboard.writeText(inviteLink); setCopied(true); } catch { setError("Copy is unavailable. Select the room link below."); } }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500"><Link className="h-4 w-4" />{copied ? "Invite link copied" : "Copy invite link"}</button><input readOnly aria-label="Room invite link" value={typeof window !== "undefined" ? inviteLink : ""} className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-neutral-400" onFocus={e => e.target.select()} /><p className="text-xs text-neutral-500">This room is deleted 24 hours after creation. Anyone with this link can edit the canvas and notes. Share a hosted or LAN address; localhost links work only on your computer.</p><ul className="space-y-1 text-xs text-neutral-400">{p.people.map(person => <li key={person.id} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: person.color }} />{person.name}</li>)}</ul></div> : <div className="mt-4 space-y-3"><p className="text-sm leading-relaxed text-neutral-400">Rooms are deleted 24 hours after creation. Create a shared copy of this board. Invite people to draw and write notes together, with live cursors and merged edits.</p><button onClick={createRoom} disabled={creating} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500">{creating ? "Creating room…" : "Create room from this board"}</button><p className="text-xs text-neutral-500">Requires the included collaboration server. Your personal board stays in its workspace.</p></div>}
      {p.roomId && p.roomChat && <div className="mt-4"><RoomChat {...p.roomChat}/></div>}
      {p.roomId && <button onClick={leaveRoom} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"><LogOut className="h-4 w-4" />Leave room</button>}
      <RoomJoinForm onJoin={p.onJoin}/>
      {error && <p role="alert" className="mt-3 text-xs text-rose-400">{error}</p>}
    </dialog></>;
}
