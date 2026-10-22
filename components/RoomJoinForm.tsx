"use client";
import { useId, useRef, useState } from "react";
import { parseRoomInvite } from "@/lib/roomInvites";
export function RoomJoinForm({
  call = false,
  onJoin,
}: {
  call?: boolean;
  onJoin: (id: string, openCall?: boolean) => void | Promise<void>;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null),
    pending = useRef(false);
  const [value, setValue] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      noValidate
      className="mt-4 space-y-2 border-t border-neutral-800 pt-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending.current) return;
        setError("");
        let invite;
        try {
          invite = parseRoomInvite(value, window.location.origin, call);
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Paste a valid invite link.",
          );
          input.current?.focus();
          return;
        }
        pending.current = true;
        setBusy(true);
        try {
          if (invite.origin !== window.location.origin)
            window.location.assign(invite.href);
          else await onJoin(invite.id, invite.call);
        } catch {
          setError("Could not open this room. Check the link and try again.");
          input.current?.focus();
        } finally {
          pending.current = false;
          setBusy(false);
        }
      }}
    >
      <label htmlFor={id} className="text-xs text-neutral-400">
        {call ? "Join with a link" : "Join an existing room"}
      </label>
      <div className="flex gap-2">
        <input
          ref={input}
          id={id}
          aria-label={call ? "Call link or room ID" : "Room link or room ID"}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
          placeholder={
            call ? "Paste call link or room ID" : "Paste room link or ID"
          }
          className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!value.trim() || busy}
          className="min-w-24 rounded-lg border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800 disabled:opacity-40"
        >
          {busy ? "Opening…" : call ? "Open call" : "Join"}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-rose-300">
          {error}
        </p>
      )}
    </form>
  );
}
