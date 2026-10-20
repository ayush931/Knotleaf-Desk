"use client";
import { useEffect, useId, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { CHAT_TEXT_LIMIT, type RoomChatProps } from "@/lib/roomChat";

/** One conversation owner reused by room sharing and the video-call panel. */
export function RoomChat({
  messages,
  connected,
  onSend,
  label = "Room chat",
}: RoomChatProps & { label?: string }) {
  const [draft, setDraft] = useState(""),
    [error, setError] = useState("");
  const log = useRef<HTMLOListElement>(null),
    composer = useRef<HTMLTextAreaElement>(null);
  const follow = useRef(true),
    id = useId();
  useEffect(() => {
    if (follow.current && log.current)
      log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);
  const send = () => {
    if (!connected || !draft.trim()) return;
    try {
      onSend(draft);
      setDraft("");
      setError("");
      follow.current = true;
      composer.current?.focus();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not send your message. Try again.",
      );
    }
  };
  return (
    <section
      aria-label={label}
      className="space-y-3 rounded-lg border border-neutral-700 bg-neutral-950/40 p-3"
    >
      <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-200">
        <MessageCircle aria-hidden="true" className="h-4 w-4 text-blue-400" />
        {label}
        <span className="ml-auto text-[11px] font-normal text-neutral-500">
          {messages.length}/100
        </span>
      </h3>
      <p
        id={`${id}-help`}
        className="text-[11px] leading-relaxed text-neutral-500"
      >
        Shared with everyone in this room, including people in the call. Last
        100 messages stay until the room expires.
      </p>
      <ol
        ref={log}
        role="log"
        aria-label={`${label} messages`}
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
        onScroll={() => {
          const el = log.current;
          if (el)
            follow.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 32;
        }}
        className="max-h-52 min-h-16 space-y-3 overflow-y-auto overscroll-contain rounded-md text-xs focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        {messages.map((message) => (
          <li key={message.id} className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 truncate font-medium text-blue-300">
                {message.name}
              </span>
              <time
                dateTime={new Date(message.at).toISOString()}
                className="shrink-0 text-[10px] text-neutral-500"
              >
                {new Date(message.at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-neutral-300 [overflow-wrap:anywhere]">
              {message.text}
            </p>
          </li>
        ))}
      </ol>
      {!messages.length && (
        <p className="text-xs text-neutral-500">
          No messages yet. Say hello to the room.
        </p>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="space-y-2"
      >
        <label htmlFor={`${id}-message`} className="sr-only">
          {label} message
        </label>
        <textarea
          id={`${id}-message`}
          ref={composer}
          aria-label={`${label} message`}
          aria-describedby={`${id}-help ${id}-status`}
          maxLength={CHAT_TEXT_LIMIT}
          rows={2}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Write a message…"
          className="block w-full resize-none rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-neutral-200"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-neutral-500">
            Enter to send · Shift+Enter for a new line
          </span>
          <button
            type="submit"
            disabled={!connected || !draft.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-300 hover:bg-blue-500/20 disabled:opacity-40"
          >
            <Send aria-hidden="true" className="h-3.5 w-3.5" />
            Send
          </button>
        </div>
      </form>
      <p
        id={`${id}-status`}
        role="status"
        className="text-[11px] text-neutral-500"
      >
        {connected
          ? "Connected · messages appear in both room and call chat."
          : "Chat disconnected. Your draft is kept; reconnect to send."}
      </p>
      {error && (
        <p role="alert" className="text-xs text-rose-300">
          {error}
        </p>
      )}
    </section>
  );
}
