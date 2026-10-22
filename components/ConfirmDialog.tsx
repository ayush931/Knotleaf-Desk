"use client";
import { useEffect, useRef, useId } from "react";
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  variant = "clear-board",
  name = "participant",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  variant?: "clear-board" | "remove-participant";
  name?: string;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[min(400px,90vw)] rounded-xl border border-neutral-700 bg-[#18181b] p-5 text-neutral-100 shadow-2xl"
    >
      <h2 id={titleId} className="text-base font-semibold">
        {variant === "remove-participant"
          ? `Remove ${name} from this call?`
          : "Clear this board?"}
      </h2>
      <p className="mt-2 text-sm text-neutral-400">
        {variant === "remove-participant"
          ? "Disconnect their microphone, camera and screen sharing. They can rejoin with the invite link."
          : "Remove all shapes and notes. You can undo the canvas change with Ctrl+Z."}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          autoFocus
          onClick={onClose}
          className="rounded-lg bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm hover:bg-rose-500"
        >
          {variant === "remove-participant"
            ? "Remove from call"
            : "Clear board"}
        </button>
      </div>
    </dialog>
  );
}
