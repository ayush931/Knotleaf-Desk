"use client";
import "katex/dist/katex.min.css";
import { useEffect, useRef, useState } from "react";
import { readDeck, deckKey, type Deck } from "@/lib/presentations/model";
import { PresentationPresenter } from "./PresentationPresenter";
export function PresentationAudience() {
  const [params] = useState(() => new URLSearchParams(location.search)),
    [deck, setDeck] = useState<Deck | null>(null),
    [index, setIndex] = useState(() =>
      Math.max(
        0,
        Number(new URLSearchParams(location.search).get("slide")) || 0,
      ),
    ),
    [error, setError] = useState("");
  const channel = useRef<BroadcastChannel | null>(null);
  const documentId = params.get("deck") || "",
    token = params.get("session") || "";
  useEffect(() => {
    let received = false;
    const connection =
      token &&
      /^[a-f\d-]{36}$/i.test(token) &&
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(`knotleaf.presenter:${token}`)
        : null;
    channel.current = connection;
    if (connection) {
      connection.onmessage = (event) => {
        const value = event.data;
        if (value?.kind === "deck") {
          try {
            setDeck(readDeck(JSON.stringify(value.deck)));
            setError("");
            received = true;
          } catch {
            setError(
              "The editor sent an unsupported presentation. Reopen the audience window.",
            );
          }
        } else if (value?.kind === "editor-ready")
          connection.postMessage({ kind: "ready" });
        else if (value?.kind === "ping")
          connection.postMessage({ kind: "pong" });
      };
      connection.postMessage({ kind: "ready" });
    }
    const timer = setTimeout(() => {
      if (received) return;
      try {
        const raw = localStorage.getItem(deckKey(documentId));
        if (!raw)
          throw new Error(
            "Open this presentation from the library on this device.",
          );
        setDeck(readDeck(raw));
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not open the presentation.",
        );
      }
    }, 600);
    const close = () => connection?.postMessage({ kind: "closed" });
    window.addEventListener("pagehide", close);
    return () => {
      clearTimeout(timer);
      close();
      window.removeEventListener("pagehide", close);
      connection?.close();
    };
  }, [documentId, token]);
  useEffect(() => {
    channel.current?.postMessage({ kind: "slide", index });
  }, [index]);
  return deck ? (
    <PresentationPresenter
      open
      deck={deck}
      index={index}
      onIndex={setIndex}
      documentId={documentId}
      onClose={() => {
        channel.current?.postMessage({ kind: "closed" });
        window.close();
        setError("Presentation ended. You can close this tab.");
        setDeck(null);
      }}
    />
  ) : (
    <main className="flex h-[100dvh] items-center justify-center bg-[#121212] p-6 text-center text-sm text-neutral-400">
      <p role={error ? "alert" : "status"}>
        {error || "Connecting to your presentation…"}
      </p>
    </main>
  );
}
