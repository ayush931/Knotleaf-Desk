"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  Video,
  X,
  Mic,
  MonitorUp,
  PhoneOff,
  Copy,
  MessageCircle,
} from "lucide-react";
import {
  ClassroomSession,
  classroomSocketUrl,
  type ClassState,
} from "@/lib/classroom";
import {
  getRoomServerUrl,
  roomInviteUrl,
  checkRoomAvailable,
} from "@/lib/roomConnection";
import { ClassroomAudioSource } from "./ClassroomAudioSource";
import { RoomChat } from "./RoomChat";
import type { RoomChatProps } from "@/lib/roomChat";
import { CallMediaVideo as MediaVideo, CallScreenView } from "./CallScreenView";
import { LocalRecorder } from "./LocalRecorder";
function PeerAudio({ stream, name }: { stream: MediaStream; name: string }) {
  const audio = useRef<HTMLAudioElement>(null),
    [blocked, setBlocked] = useState(false),
    tracks = stream.getTracks().length;
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    element.srcObject = stream;
    if (tracks) void element.play().catch(() => setBlocked(true));
    return () => {
      element.srcObject = null;
    };
  }, [stream, tracks]);
  return (
    <>
      <audio ref={audio} autoPlay />
      {blocked && (
        <button
          className="rounded border border-neutral-700 px-2 py-1 text-xs"
          onClick={() => {
            void audio.current
              ?.play()
              .then(() => setBlocked(false))
              .catch(() => {});
          }}
        >
          Enable sound for {name}
        </button>
      )}
    </>
  );
}
export function Classroom({
  roomId,
  onCreateRoom,
  onRecordingChange,
  uiHidden = false,
  roomChat,
  onName,
}: {
  roomChat?: RoomChatProps;
  onName?: (name: string) => void;
  roomId?: string;
  uiHidden?: boolean;
  onCreateRoom?: () => Promise<void>;
  onRecordingChange?: (active: boolean) => void;
}) {
  const search = useSearchParams(),
    panelId = useId(),
    trigger = useRef<HTMLButtonElement>(null);
  const minimize = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  const [open, setOpen] = useState(
      () => !!roomId && search.get("classroom") === "1",
    ),
    [name, setName] = useState(""),
    [state, setState] = useState<ClassState | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const client = useRef<ClassroomSession | null>(null),
    input = useRef<HTMLInputElement>(null);
  const joinAbort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      joinAbort.current?.abort();
      if (client.current) {
        client.current.onState = undefined;
        client.current.onError = undefined;
        client.current.close();
      }
    },
    [],
  );
  useEffect(() => {
    if (open && state?.status !== "connected") {
      const frame = requestAnimationFrame(() => input.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [open, state?.status]);
  const join = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError("Enter your name first.");
      input.current?.focus();
      return;
    }
    if (!roomId) return;
    if (typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices) {
      setError("Calls need a current browser over HTTPS (or localhost).");
      return;
    }
    onName?.(name.trim());
    client.current?.close();
    setError("");
    setBusy("join");
    const controller = new AbortController();
    joinAbort.current?.abort();
    joinAbort.current = controller;
    try {
      const base = await getRoomServerUrl(controller.signal);
      await checkRoomAvailable(base, roomId, controller.signal);
      if (controller.signal.aborted) return;
      const session = new ClassroomSession(
        classroomSocketUrl(base, roomId),
        name.trim(),
      );
      client.current = session;
      session.onState = (next) => {
        setState(next);
        if (next.status !== "joining") setBusy("");
      };
      session.onError = (message) => {
        setError(message);
        setBusy("");
      };
    } catch (error) {
      if (controller.signal.aborted) return;
      setBusy("");
      setError(
        error instanceof Error
          ? error.message
          : "Could not connect to the call server. Retry.",
      );
    }
  };
  const leave = () => {
    joinAbort.current?.abort();
    if (client.current) {
      client.current.onState = undefined;
      client.current.onError = undefined;
      client.current.close();
      client.current = null;
    }
    setState(null);
    setBusy("");
    setError("");
  };
  const act = async (action: string) => {
    if (busy) return;
    setBusy(action);
    setError("");
    try {
      if (action === "screen" || action === "change-screen")
        await client.current?.toggleScreen(action === "change-screen");
      else await client.current?.toggle(action as "mic" | "camera");
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "NotAllowedError" &&
        (action === "screen" || action === "change-screen")
      )
        return;
      setError(
        error instanceof Error
          ? error.message
          : "Media could not start. Check browser permissions and retry.",
      );
    } finally {
      setBusy("");
    }
  };
  const createRoom = async () => {
    if (!onCreateRoom || busy) return;
    setBusy("create");
    setError("");
    try {
      await onCreateRoom();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not create a room. Retry from Share.",
      );
    } finally {
      setBusy("");
    }
  };
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector("dialog[data-call-screen][open]")
      ) {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  const [copyStatus, setCopyStatus] = useState({ link: "", message: "" }),
    inviteInput = useRef<HTMLInputElement>(null);
  const inviteLink =
    roomId && typeof window !== "undefined" ? roomInviteUrl(roomId, true) : "";
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyStatus({ link: inviteLink, message: "Invite link copied" });
    } catch {
      inviteInput.current?.focus();
      inviteInput.current?.select();
      setCopyStatus({
        link: inviteLink,
        message: "Select and copy the link above.",
      });
    }
  };
  const selectMicrophone = async (id: string) => {
    if (busy) return;
    setBusy("source");
    setError("");
    try {
      await client.current?.selectMicrophone(id);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not switch microphone. Your current source is unchanged.",
      );
    } finally {
      setBusy("");
    }
  };
  useEffect(() => {
    if (open && chatOpen) {
      document
        .getElementById(`${panelId}-chat`)
        ?.querySelector<HTMLTextAreaElement>("textarea")
        ?.focus();
    }
  }, [open, chatOpen, panelId]);
  const connected = state?.status === "connected";
  const control =
    "flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2 text-xs hover:bg-neutral-800 disabled:opacity-40";
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-controls={panelId}
        aria-label="Open live call"
        aria-expanded={open}
        title="Live call · video, screen sharing and local recording"
        onClick={() => setOpen((previous) => !previous)}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10"
      >
        <Video className="h-4 w-4" />
        <span className="hidden lg:inline">Live call</span>
        {connected && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        )}
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <aside
            id={panelId}
            aria-label="Live call"
            className={`${open && !uiHidden ? "flex" : "hidden"} fixed bottom-3 right-3 top-14 z-50 w-[min(560px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 text-white shadow-2xl`}
          >
            <header className="flex items-center justify-between border-b border-neutral-700 p-3">
              <h2 className="text-sm font-semibold">
                Live call{" "}
                {connected && (
                  <span className="ml-1 text-xs font-normal text-neutral-400">
                    · {state.peers.length + 1} people
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                {roomId && roomChat && (
                  <button
                    type="button"
                    aria-label={chatOpen ? "Hide call chat" : "Show call chat"}
                    aria-expanded={chatOpen}
                    aria-controls={`${panelId}-chat`}
                    onClick={() => setChatOpen((value) => !value)}
                    className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2 py-1.5 text-xs text-blue-300 hover:bg-neutral-800"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Chat
                    {roomChat.messages.length > 0 && (
                      <span className="text-neutral-400">
                        {roomChat.messages.length}
                      </span>
                    )}
                  </button>
                )}
                <button
                  aria-label="Minimize live call"
                  title="Minimize · call stays connected"
                  onClick={minimize}
                  className="note-tool"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {roomId && roomChat && (
                <div id={`${panelId}-chat`} hidden={!chatOpen}>
                  <RoomChat {...roomChat} label="Call chat" />
                </div>
              )}
              {roomId && (
                <div className="space-y-1.5">
                  <label
                    htmlFor={`${panelId}-invite`}
                    className="text-xs text-neutral-400"
                  >
                    Call invite link
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`${panelId}-invite`}
                      ref={inviteInput}
                      readOnly
                      aria-label="Call invite link"
                      value={inviteLink}
                      onFocus={(e) => e.target.select()}
                      className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-xs text-neutral-300"
                    />
                    <button
                      type="button"
                      onClick={() => void copyInvite()}
                      className={control}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                  </div>
                  <p
                    aria-live="polite"
                    className="text-[11px] text-neutral-400"
                  >
                    {(copyStatus.link === inviteLink && copyStatus.message) ||
                      "Anyone with this link can edit the board and notes and join the call."}
                  </p>
                </div>
              )}
              {!roomId ? (
                <div className="space-y-3 p-2">
                  <p className="text-sm text-neutral-400">
                    Create a shared room to invite others, edit together and
                    join a call.
                  </p>
                  {onCreateRoom && (
                    <button
                      disabled={!!busy}
                      onClick={() => void createRoom()}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm disabled:opacity-50"
                    >
                      {busy === "create"
                        ? "Creating room…"
                        : "Create room & open call"}
                    </button>
                  )}
                  <p className="text-xs text-neutral-500">
                    To join an existing call, open its invite link or use Share.
                  </p>
                </div>
              ) : !connected ? (
                <form
                  noValidate
                  className="space-y-4 p-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    join();
                  }}
                >
                  <p className="text-sm text-neutral-400">
                    Talk and share your screen while working on the same canvas,
                    code and notes. Camera and microphone start off.
                  </p>
                  <label className="block text-xs">
                    Your display name
                    <input
                      ref={input}
                      maxLength={40}
                      value={name}
                      aria-invalid={!!error && !name.trim()}
                      aria-describedby={error ? "classroom-error" : undefined}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-2 block w-full rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-sm"
                    />
                  </label>
                  <button
                    disabled={busy === "join"}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {busy === "join"
                      ? "Joining…"
                      : state?.status === "disconnected"
                        ? "Rejoin call"
                        : "Join call"}
                  </button>
                  {state?.status === "disconnected" && (
                    <p role="status" className="text-xs text-amber-300">
                      The call disconnected. Your board edits stay in the room.
                      Rejoin to reconnect.
                    </p>
                  )}
                </form>
              ) : (
                <>
                  <div
                    role="toolbar"
                    aria-label="Call controls"
                    className="flex flex-wrap gap-2"
                  >
                    <button
                      className={`${control} ${state.media.mic ? "text-blue-300" : ""}`}
                      disabled={!!busy}
                      aria-pressed={state.media.mic}
                      onClick={() => void act("mic")}
                    >
                      <Mic className="h-4 w-4" />
                      {state.media.mic ? "Mute" : "Microphone"}
                    </button>
                    <button
                      className={`${control} ${state.media.camera ? "text-blue-300" : ""}`}
                      disabled={!!busy}
                      aria-pressed={state.media.camera}
                      onClick={() => void act("camera")}
                    >
                      <Video className="h-4 w-4" />
                      {state.media.camera ? "Camera off" : "Camera"}
                    </button>
                    <button
                      className={`${control} ${state.media.screen ? "text-blue-300" : ""}`}
                      disabled={!!busy}
                      aria-pressed={state.media.screen}
                      onClick={() => void act("screen")}
                    >
                      <MonitorUp className="h-4 w-4" />
                      {state.media.screen ? "Stop sharing" : "Share screen"}
                    </button>
                    {state.media.screen && (
                      <button
                        type="button"
                        className={control}
                        disabled={!!busy}
                        onClick={() => void act("change-screen")}
                      >
                        Change screen source
                      </button>
                    )}
                    <button
                      className={`${control} text-rose-300`}
                      onClick={leave}
                    >
                      <PhoneOff className="h-4 w-4" />
                      Leave call
                    </button>
                  </div>
                  <ClassroomAudioSource
                    deviceId={state.microphoneId}
                    label={state.microphoneLabel}
                    enabled={state.media.mic}
                    busy={!!busy}
                    onChange={(id) => void selectMicrophone(id)}
                  />
                  <p className="text-[11px] text-neutral-500">
                    Small-group call · up to {state.maxParticipants} people
                    {!state.relayConfigured
                      ? " · no network relay configured"
                      : ""}
                  </p>
                  {state.screen && (
                    <CallScreenView
                      stream={state.screen}
                      label="Your shared screen"
                      detail={`Your screen · ${state.screen.getAudioTracks().length ? "screen/tab audio shared" : "screen/tab audio off"}`}
                    />
                  )}
                  {state.peers
                    .filter((p) => p.media.screen)
                    .map((peer) => (
                      <CallScreenView
                        key={`screen-${peer.id}`}
                        stream={peer.screen}
                        label={`${peer.name}'s screen`}
                        detail={`${peer.name} · ${peer.status === "connected" ? "screen" : peer.status}`}
                      />
                    ))}
                  <div className="grid grid-cols-2 gap-2">
                    <figure className="overflow-hidden rounded-lg border border-neutral-800">
                      {state.media.camera ? (
                        <MediaVideo stream={state.camera} label="Your camera" />
                      ) : (
                        <div className="flex aspect-video items-center justify-center bg-neutral-950 text-2xl text-neutral-500">
                          {name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <figcaption className="px-2 py-1 text-xs text-neutral-400">
                        You · {state.media.mic ? "mic on" : "muted"}
                      </figcaption>
                    </figure>
                    {state.peers.map((peer) => (
                      <figure
                        key={peer.id}
                        className="overflow-hidden rounded-lg border border-neutral-800"
                      >
                        {peer.media.camera ? (
                          <MediaVideo
                            stream={peer.camera}
                            label={`${peer.name}'s camera`}
                          />
                        ) : (
                          <div className="flex aspect-video items-center justify-center bg-neutral-950 text-2xl text-neutral-500">
                            {peer.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <figcaption className="truncate px-2 py-1 text-xs text-neutral-400">
                          {peer.name} ·{" "}
                          {peer.status === "connected"
                            ? peer.media.mic
                              ? "mic on"
                              : "muted"
                            : peer.status}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                  {!state.peers.length && (
                    <p role="status" className="py-2 text-xs text-neutral-400">
                      You’re the first here. Invite others using the room’s
                      Share link.
                    </p>
                  )}
                </>
              )}
              {state?.peers.map((peer) => (
                <PeerAudio key={peer.id} stream={peer.audio} name={peer.name} />
              ))}
              {error && (
                <p
                  id="classroom-error"
                  role="alert"
                  className="text-xs text-rose-300"
                >
                  {error}
                </p>
              )}
            </div>
            <LocalRecorder onActivityChange={onRecordingChange} />
          </aside>,
          document.body,
        )}
    </>
  );
}
