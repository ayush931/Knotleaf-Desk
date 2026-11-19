"use client";
import { PresentationAnnotations } from "./PresentationAnnotations";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Deck, Slide } from "@/lib/presentations/model";
import { themeBackdrop, themeTypography } from "@/lib/presentations/design";
import { renderSlide } from "@/lib/presentations/render";
import { SLIDE_CSS } from "@/lib/presentations/styles";
import { themeVariables, decorateSlide } from "@/lib/presentations/export";
export function SlideStyles() {
  return <style>{SLIDE_CSS}</style>;
}

export function SlideSurface({
  slide,
  deck,
  step = Infinity,
  laser = false,
  animate = false,
  annotationKey,
  animationKey,
  direction = 1,
  lazy = false,
  sharedStyles = false,
}: {
  slide: Slide;
  deck: Deck;
  step?: number;
  laser?: boolean;
  animate?: boolean;
  annotationKey?: string;
  animationKey?: string;
  direction?: number;
  lazy?: boolean;
  sharedStyles?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    surface = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0),
    [result, setResult] = useState<{ source: string; html: string; error: string } | null>(null),
    [overflow, setOverflow] = useState(false);
  const [visible, setVisible] = useState(!lazy);
  useEffect(() => {
    if (!lazy || !host.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [lazy]);
  const source = slide.source,
    html = result?.html ?? "",
    error = result?.source === source ? result.error : "";
  const backgroundImage = deck.backgroundImage;
  const markup = useMemo(() => ({
    __html: decorateSlide(html, { backgroundImage }),
  }), [backgroundImage, html]);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) =>
      setScale(
        Math.min(
          entry.contentRect.width / 1280,
          entry.contentRect.height / 720,
        ),
      ),
    );
    resize.observe(element);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      renderSlide({ source }, lazy)
        .then((value) => {
          if (!cancelled) setResult({ source, html: value, error: "" });
        })
        .catch((reason) => {
          if (!cancelled)
            setResult({
              source,
              html: "",
              error:
                reason instanceof Error
                  ? reason.message
                  : "Could not preview this slide.",
            });
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, visible, lazy]);
  useLayoutEffect(() => {
    const element = surface.current;
    if (!element) return;
    element
      .querySelectorAll<HTMLElement>("[data-step]")
      .forEach(
        (part) =>
          (part.dataset.hidden = String(Number(part.dataset.step) > step)),
      );
  }, [markup, result, step]);
  useEffect(() => {
    const element = surface.current;
    if (!element || lazy || animate) return;
    const check = () =>
      setOverflow(element.scrollHeight > 724 || element.scrollWidth > 1284);
    check();
    document.fonts?.addEventListener("loadingdone", check);
    element
      .querySelectorAll("img")
      .forEach((image) => image.addEventListener("load", check));
    return () => {
      document.fonts?.removeEventListener("loadingdone", check);
      element
        .querySelectorAll("img")
        .forEach((image) => image.removeEventListener("load", check));
    };
  }, [result, markup, lazy, animate, slide.theme, slide.layout, deck.theme, deck.layout, deck.template, deck.bodySize, deck.headingFont, deck.bodyFont]);
  const lastAnimation = useRef<string | undefined>(undefined);
  useEffect(() => {
    const element = surface.current,
      key = animationKey || result?.source;
    if (
      !element ||
      !animate ||
      !result || result.error || result.source !== source ||
      lastAnimation.current === key
    )
      return;
    lastAnimation.current = key;
    if (
      deck.transition === "none" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const frames: Record<string, Keyframe[]> = {
      slide: [
        { opacity: 0, translate: `${direction < 0 ? -30 : 30}px 0` },
        { opacity: 1, translate: "0 0" },
      ],
      fade: [{ opacity: 0 }, { opacity: 1 }],
      zoom: [
        { opacity: 0, scale: 0.97 },
        { opacity: 1, scale: 1 },
      ],
      lift: [
        { opacity: 0, translate: "0 16px" },
        { opacity: 1, translate: "0 0" },
      ],
    };
    const animations = [
      element.animate(frames[deck.transition || "fade"] || frames.fade, {
        duration: 260,
        easing: "cubic-bezier(.2,.7,.2,1)",
      }),
    ];
    if (deck.animateBlocks !== false)
      element
        .querySelectorAll<HTMLElement>(":scope > [data-step] > *")
        .forEach((block, index) =>
          animations.push(
            block.animate(
              [
                { opacity: 0, translate: "0 6px" },
                { opacity: 1, translate: "0 0" },
              ],
              {
                duration: 220,
                delay: Math.min(index, 6) * 35,
                fill: "both",
                easing: "ease-out",
              },
            ),
          ),
        );
    return () => animations.forEach((animation) => animation.cancel());
  }, [
    html,
    result,
    source,
    animationKey,
    animate,
    direction,
    deck.transition,
    deck.animateBlocks,
  ]);
  useEffect(() => {
    const type = themeTypography(slide.theme || deck.theme);
    const fonts = [
      deck.headingFont || type.heading,
      deck.bodyFont || type.body,
    ].filter(Boolean) as import("@/draw/fonts").FontFamily[];
    if (fonts.length)
      void import("@/draw/renderer").then(({ loadCanvasFonts }) =>
        loadCanvasFonts(fonts),
      );
  }, [deck.headingFont, deck.bodyFont, deck.theme, slide.theme]);
  return (
    <div
      ref={host}
      style={{ cursor: laser ? "none" : undefined }}
      className="slide-stage relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-[#0d0d0f]"
      onPointerMove={(event) => {
        if (!laser) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      }}
      onPointerLeave={() => setPointer(null)}
    >
      {!sharedStyles && <SlideStyles />}
      {result && !result.error ? (
        <div
          className="slide-frame"
          style={{ width: 1280 * scale, height: 720 * scale, flexShrink: 0 }}
        >
          <div
            ref={surface}
            className="kl-slide select-text"
            data-theme={slide.theme || deck.theme}
            data-layout={slide.layout || deck.layout}
            data-template={deck.template || "classic"}
            data-background={themeBackdrop(
              slide.theme || deck.theme,
              deck.backdrop,
            )}
            data-live={animate}
            data-motion={deck.animateBackground !== false}
            data-blocks={deck.animateBlocks !== false}
            style={{
              ...themeVariables({ ...deck, theme: slide.theme || deck.theme }),
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            dangerouslySetInnerHTML={markup}
          />
        </div>
      ) : !lazy && (
        <p role="status" className="p-4 text-center text-sm text-neutral-400">
          {error || "Preparing slide…"}
        </p>
      )}
      {annotationKey && html && (
        <PresentationAnnotations
          key={annotationKey}
          annotationKey={annotationKey}
          rootRef={surface}
          revision={html}
        />
      )}
      {overflow && result && !result.error && !lazy && !animate && (
        <span className="absolute left-2 top-2 rounded bg-neutral-950 px-2 py-1 text-xs text-neutral-200">
          Content overflows. Split this slide or shorten the text.
        </span>
      )}
      {laser && pointer && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-3 w-3 rounded-full ui-primary shadow-[0_0_16px_4px_#ef444499]"
          style={{ left: pointer.x - 6, top: pointer.y - 6 }}
        />
      )}
    </div>
  );
}
