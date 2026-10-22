"use client";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { AudioLines, Mic, MicOff, Shield } from "lucide-react";
import type { CallRole, ModerationAction } from "@/lib/classroom";
export interface CallParticipant {
  id: string;
  name: string;
  role: CallRole;
  mic: boolean;
  speaking: boolean;
  self?: boolean;
}
export function CallParticipants({
  people,
  role,
  onModerate,
  onToggleMicrophone,
  busy = false,
  compact = false,
}: {
  people: CallParticipant[];
  role: CallRole;
  onModerate: (action: ModerationAction, id?: string) => void;
  compact?: boolean;
  onToggleMicrophone?: () => void;
  busy?: boolean;
}) {
  const [removing, setRemoving] = useState<CallParticipant | null>(null);
  return (
    <>
      <section aria-label="Call participants" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-neutral-300">
            Participants · {people.length}
          </h3>
          {role !== "participant" && people.length > 1 && (
            <button
              type="button"
              className="note-tool text-xs"
              onClick={() => onModerate("mute-all")}
            >
              Mute participants
            </button>
          )}
        </div>
        <div
          className={`grid gap-2 ${compact ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}
        >
          {people.map((person) => {
            const manageable =
              !person.self &&
              person.role !== "host" &&
              (role === "host" ||
                (role === "cohost" && person.role === "participant"));
            return (
              <div
                key={person.id}
                data-participant={person.id}
                aria-label={`${person.name}${person.self ? ", you" : ""}, ${person.role}, microphone ${person.mic ? "on" : "off"}${person.speaking ? ", speaking" : ""}`}
                className={`min-w-0 rounded-lg border p-2 text-xs ${person.speaking ? "border-blue-400 bg-blue-500/10" : "border-neutral-700 bg-neutral-950"}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-neutral-100">
                    {person.name}
                    {person.self ? " · You" : ""}
                  </span>
                  {person.speaking && (
                    <AudioLines
                      aria-label="Speaking"
                      className="h-4 w-4 shrink-0 text-blue-400"
                    />
                  )}
                  {person.self && onToggleMicrophone ? (
                    <button
                      type="button"
                      className="note-tool"
                      aria-label={
                        person.mic
                          ? "Mute your microphone"
                          : "Turn on your microphone"
                      }
                      title={
                        person.mic ? "Mute microphone" : "Turn on microphone"
                      }
                      disabled={busy}
                      onClick={onToggleMicrophone}
                    >
                      {person.mic ? (
                        <Mic className="h-3.5 w-3.5 text-blue-300" />
                      ) : (
                        <MicOff className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : person.mic ? (
                    <Mic
                      aria-label="Microphone on"
                      className="h-3.5 w-3.5 shrink-0 text-blue-300"
                    />
                  ) : (
                    <MicOff
                      aria-label="Microphone off"
                      className="h-3.5 w-3.5 shrink-0 text-neutral-500"
                    />
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-neutral-400">
                  {person.role !== "participant" && (
                    <Shield className="h-3 w-3" />
                  )}
                  {person.role === "host"
                    ? "Host"
                    : person.role === "cohost"
                      ? "Co-host"
                      : "Participant"}
                  {person.speaking && (
                    <span className="ml-auto text-blue-300">Speaking</span>
                  )}
                </div>
                {manageable && (
                  <details className="mt-1">
                    <summary
                      className="cursor-pointer rounded py-1 text-neutral-400 hover:text-white"
                      aria-label={`Manage ${person.name}`}
                    >
                      Manage
                    </summary>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {person.mic && (
                        <button
                          type="button"
                          className="note-tool"
                          onClick={() => onModerate("mute", person.id)}
                        >
                          Mute
                        </button>
                      )}
                      {role === "host" && (
                        <button
                          type="button"
                          className="note-tool"
                          onClick={() =>
                            onModerate(
                              person.role === "cohost" ? "demote" : "promote",
                              person.id,
                            )
                          }
                        >
                          {person.role === "cohost"
                            ? "Remove co-host"
                            : "Make co-host"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="note-tool text-rose-300"
                        onClick={() => setRemoving(person)}
                      >
                        Remove from call
                      </button>
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <ConfirmDialog
        open={!!removing && people.some((person) => person.id === removing.id)}
        variant="remove-participant"
        name={removing?.name}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) onModerate("remove", removing.id);
        }}
      />
    </>
  );
}
