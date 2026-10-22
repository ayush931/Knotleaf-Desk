"use client";
import { useEffect, useRef, useState } from "react";
export interface SpeakingSource {
  id: string;
  stream: MediaStream | null;
  enabled: boolean;
}
/** One silent graph for the visible call; no microphone capture or audible monitoring. */
export function useCallSpeaking(sources: SpeakingSource[], active: boolean) {
  const latest = useRef(sources),
    [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  useEffect(() => {
    latest.current = sources;
  }, [sources]);
  useEffect(() => {
    if (!active || typeof AudioContext === "undefined") return;
    const context = new AudioContext(),
      nodes = new Map<
        string,
        {
          track: MediaStreamTrack;
          source: MediaStreamAudioSourceNode;
          analyser: AnalyserNode;
          data: Uint8Array<ArrayBuffer>;
          last: number;
        }
      >();
    const resume = () => {
      if (context.state === "suspended") void context.resume().catch(() => {});
    };
    resume();
    document.addEventListener("pointerdown", resume);
    document.addEventListener("keydown", resume);
    const timer = setInterval(() => {
      const next: Record<string, boolean> = {},
        wanted = new Set<string>(),
        now = performance.now();
      if (document.visibilityState !== "hidden" && context.state === "running")
        for (const item of latest.current) {
          const track = item.enabled
            ? item.stream
                ?.getAudioTracks()
                .find((track) => track.readyState !== "ended" && track.enabled)
            : undefined;
          if (!track) continue;
          wanted.add(item.id);
          let entry = nodes.get(item.id);
          if (!entry || entry.track !== track) {
            entry?.source.disconnect();
            try {
              const source = context.createMediaStreamSource(
                  new MediaStream([track]),
                ),
                analyser = context.createAnalyser();
              analyser.fftSize = 256;
              source.connect(analyser);
              entry = {
                track,
                source,
                analyser,
                data: new Uint8Array(new ArrayBuffer(256)),
                last: -Infinity,
              };
              nodes.set(item.id, entry);
            } catch {
              continue;
            }
          }
          entry.analyser.getByteTimeDomainData(entry.data);
          let energy = 0;
          for (const sample of entry.data) {
            const level = (sample - 128) / 128;
            energy += level * level;
          }
          if (Math.sqrt(energy / entry.data.length) > 0.025) entry.last = now;
          if (now - entry.last < 450) next[item.id] = true;
        }
      for (const [id, entry] of nodes)
        if (!wanted.has(id)) {
          entry.source.disconnect();
          nodes.delete(id);
        }
      setSpeaking((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    }, 100);
    return () => {
      clearInterval(timer);
      document.removeEventListener("pointerdown", resume);
      document.removeEventListener("keydown", resume);
      for (const entry of nodes.values()) entry.source.disconnect();
      void context.close().catch(() => {});
    };
  }, [active]);
  return active ? speaking : {};
}
