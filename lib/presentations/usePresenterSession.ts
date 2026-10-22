"use client";
import { useEffect, useRef, useState } from "react";
import type { Deck } from "./model";
export function usePresenterSession(
  documentId: string,
  deck: Deck | null,
  onSlide: (index: number) => void,
) {
  const [token, setToken] = useState(() => {
      try {
        return sessionStorage.getItem(`knotleaf.presenter:${documentId}`) || "";
      } catch {
        return "";
      }
    }),
    [following, setFollowing] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null),
    currentDeck = useRef(deck),
    follow = useRef(false),
    lastSeen = useRef(0);
  useEffect(() => {
    currentDeck.current = deck;
  }, [deck]);
  useEffect(() => {
    follow.current = following;
  }, [following]);
  useEffect(() => {
    if (!token || typeof BroadcastChannel === "undefined") return;
    const connection = new BroadcastChannel(`knotleaf.presenter:${token}`);
    channel.current = connection;
    connection.onmessage = (event) => {
      const value = event.data;
      if (value?.kind === "ready") {
        lastSeen.current = Date.now();
        follow.current = true;
        setFollowing(true);
        if (currentDeck.current)
          connection.postMessage({ kind: "deck", deck: currentDeck.current });
      } else if (value?.kind === "slide" && Number.isFinite(value.index)) {
        lastSeen.current = Date.now();
        if (follow.current) onSlide(Math.max(0, Math.floor(value.index)));
      } else if (value?.kind === "closed") {
        setFollowing(false);
        lastSeen.current = 0;
      } else if (value?.kind === "pong") lastSeen.current = Date.now();
    };
    connection.postMessage({ kind: "editor-ready" });
    const timer = setInterval(() => {
      if (lastSeen.current && Date.now() - lastSeen.current < 30000)
        connection.postMessage({ kind: "ping" });
    }, 10000);
    return () => {
      clearInterval(timer);
      connection.close();
      if (channel.current === connection) channel.current = null;
    };
  }, [token, onSlide]);
  useEffect(() => {
    if (!deck || !channel.current) return;
    const timer = setTimeout(() => {
      if (Date.now() - lastSeen.current < 30000)
        channel.current?.postMessage({ kind: "deck", deck });
    }, 200);
    return () => clearTimeout(timer);
  }, [deck]);
  const open = (index: number) => {
    const session = token || crypto.randomUUID();
    try {
      sessionStorage.setItem(`knotleaf.presenter:${documentId}`, session);
    } catch {}
    setToken(session);
    const target = window.open(
      `/present?deck=${encodeURIComponent(documentId)}&session=${encodeURIComponent(session)}&slide=${index}`,
      "_blank",
      "popup,width=1280,height=800",
    );
    if (target) {
      target.opener = null;
      follow.current = true;
      setFollowing(true);
      return true;
    }
    return false;
  };
  return {
    open,
    following,
    stopFollowing: () => {
      follow.current = false;
      setFollowing(false);
    },
  };
}
