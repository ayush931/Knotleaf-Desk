"use client";
import { useEffect, useId, useState } from "react";
export function ClassroomAudioSource({
  deviceId,
  label,
  enabled,
  busy,
  onChange,
}: {
  deviceId: string;
  label: string;
  enabled: boolean;
  busy: boolean;
  onChange: (id: string) => void;
}) {
  const id = useId(),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [error, setError] = useState(""),
    [refreshId, setRefreshId] = useState(0),
    [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const media = navigator.mediaDevices;
    let active = true,
      request = 0;
    const refresh = async () => {
      const version = ++request;
      if (!media?.enumerateDevices) return;
      setRefreshing(true);
      try {
        const list = await media.enumerateDevices();
        if (active && version === request) {
          setDevices(
            list.filter(
              (d) =>
                d.kind === "audioinput" &&
                d.deviceId &&
                d.deviceId !== "default",
            ),
          );
          setError("");
        }
      } catch {
        if (active && version === request)
          setError(
            "Microphone list unavailable. Auto still uses your system microphone.",
          );
      } finally {
        if (active && version === request) setRefreshing(false);
      }
    };
    void refresh();
    media?.addEventListener?.("devicechange", refresh);
    return () => {
      active = false;
      media?.removeEventListener?.("devicechange", refresh);
    };
  }, [enabled, label, refreshId]);
  const selected = devices.find((d) => d.deviceId === deviceId);
  return (
    <div className="space-y-1.5 text-xs">
      <label htmlFor={id} className="text-neutral-400">
        Audio source
      </label>
      <select
        id={id}
        aria-label="Microphone source"
        value={deviceId}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-xs disabled:opacity-50"
      >
        <option value="">
          Auto{enabled && label ? ` · ${label}` : " · system default"}
        </option>
        {deviceId && !selected && (
          <option value={deviceId}>Selected microphone · unavailable</option>
        )}
        {devices.map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Microphone ${i + 1}`}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy || refreshing}
        className="note-tool text-xs disabled:opacity-40"
        onClick={() => setRefreshId((value) => value + 1)}
      >
        {refreshing ? "Detecting microphones…" : "Redetect microphones"}
      </button>
      <p role="status" className="break-words text-neutral-400">
        {enabled
          ? `Using: ${label || "System microphone"}`
          : `Microphone off · ${deviceId ? selected?.label || "selected microphone" : "Auto"}`}
      </p>
      {!enabled && !devices.some((d) => d.label) && (
        <p className="text-[11px] text-neutral-500">
          Turn on the microphone to reveal device names.
        </p>
      )}
      {error && <p className="text-[11px] text-amber-300">{error}</p>}
    </div>
  );
}
