"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  X,
  Grid2X2,
  HelpCircle,
  Pencil,
  Eraser,
  Undo2,
  Trash2,
} from "lucide-react";
import { parseSlides, revealCount, type Deck } from "@/lib/presentations/model";
import { PresentationHtml } from "./PresentationHtml";
import { SlideSurface } from "./PresentationSlide";
import { PresentationInk, type InkTool } from "./PresentationInk";
const button =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40";
const colors = ["#ef4444", "#facc15", "#60a5fa", "#4ade80", "#f4f4f5"];
export function PresentationPresenter({
  open,
  deck,
  index,
  onIndex,
  onClose,
  documentId,
}: {
  open: boolean;
  deck: Deck;
  index: number;
  onIndex: (value: number) => void;
  onClose: () => void;
  documentId: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    touchStart = useRef<{ x: number; y: number } | null>(null);
  const slides = useMemo(() => parseSlides(deck.source), [deck.source]);
  const active = Math.max(0, Math.min(index, slides.length - 1));
  const [direction, setDirection] = useState(1);
  const [step, setStep] = useState(0),
    [laser, setLaser] = useState(false),
    [blank, setBlank] = useState(false),
    [blackout, setBlackout] = useState(false),
    [overview, setOverview] = useState(false),
    [help, setHelp] = useState(false),
    [tool, setTool] = useState<InkTool>("off"),
    [color, setColor] = useState(colors[0]),
    [width, setWidth] = useState(4),
    [clearVersion, setClear] = useState(0),
    [undoVersion, setUndo] = useState(0),
    [elapsed, setElapsed] = useState(0),
    [clockRunning, setClockRunning] = useState(true),
    [timeGoal, setTimeGoal] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (!open || !clockRunning) return;
    const started = performance.now();
    let counted = 0;
    const timer = setInterval(() => {
      const seconds = Math.floor((performance.now() - started) / 1000);
      const delta = seconds - counted;
      counted = seconds;
      if (delta > 0) setElapsed((value) => value + delta);
    }, 1000);
    return () => clearInterval(timer);
  }, [open, clockRunning]);
  const jump = (value: number) => {
    setDirection(value < active ? -1 : 1);
    onIndex(Math.max(0, Math.min(value, slides.length - 1)));
    setStep(0);
    setOverview(false);
  };
  const navigate = (direction: number) => {
    if (blackout) {
      setBlackout(false);
      return;
    }
    if (overview || help || deck.kind === "html") return;
    if (direction > 0) {
      if (step < revealCount(slides[active].source))
        setStep((value) => value + 1);
      else jump(active + 1);
    } else if (step > 0) setStep((value) => value - 1);
    else jump(active - 1);
  };
  const full = () => {
    const action = document.fullscreenElement
      ? document.exitFullscreen()
      : dialog.current?.requestFullscreen();
    void action?.catch(() =>
      setError(
        "Fullscreen is unavailable. Expanded presentation remains available.",
      ),
    );
  };
  const toggleBlank = () => {
    setBlank((value) => !value);
    setBlackout(false);
    setTool("pen");
  };
  const close = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    onClose();
  };
  return (
    <dialog
      ref={dialog}
      aria-label="Presentation audience view"
      onCancel={(event) => {
        if (help || overview || laser || tool !== "off" || blank || blackout) {
          event.preventDefault();
          if (help) setHelp(false);
          else if (overview) setOverview(false);
          else if (blackout) setBlackout(false);
          else if (blank) setBlank(false);
          else {
            setLaser(false);
            setTool("off");
          }
        } else close();
      }}
      onClose={onClose}
      onKeyDown={(event) => {
        if (
          event.nativeEvent.isComposing ||
          (event.target as HTMLElement).matches(
            "input,textarea,select,[contenteditable=true]",
          )
        )
          return;
        const key = event.key.toLowerCase();
        if (
          key === "escape" ||
          ([" ", "enter"].includes(key) &&
            (event.target as HTMLElement).closest("button"))
        )
          return;
        if (blackout) {
          if (["b", " ", "enter"].includes(key)) {
            event.preventDefault();
            setBlackout(false);
          }
          return;
        }
        if ((event.ctrlKey || event.metaKey) && key === "z" && tool !== "off") {
          event.preventDefault();
          setUndo((value) => value + 1);
          return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (["arrowright", "arrowdown", "pagedown", " "].includes(key)) {
          event.preventDefault();
          navigate(1);
        } else if (
          ["arrowleft", "arrowup", "pageup", "backspace"].includes(key)
        ) {
          event.preventDefault();
          navigate(-1);
        } else if (key === "home") {
          event.preventDefault();
          jump(0);
        } else if (key === "end") {
          event.preventDefault();
          jump(slides.length - 1);
        } else if (key === "o") setOverview((value) => !value);
        else if (key === "f") full();
        else if (key === "l") {
          setLaser((value) => !value);
          setTool("off");
        } else if (key === "d") {
          setTool((value) => (value === "off" ? "pen" : "off"));
          setLaser(false);
        } else if (key === "c") toggleBlank();
        else if (key === "b") setBlackout(true);
        else if (key === "?" || key === "h") setHelp((value) => !value);
        else if (tool !== "off") {
          if (/^[1-5]$/.test(key)) setColor(colors[Number(key) - 1]);
          else if (key === "e")
            setTool((value) => (value === "eraser" ? "pen" : "eraser"));
          else if (key === "[") setWidth((value) => Math.max(1, value - 1));
          else if (key === "]") setWidth((value) => value + 1);
          else if (key === "x") setClear((value) => value + 1);
        }
      }}
      className="m-auto h-[100dvh] max-h-none w-screen max-w-none border-0 bg-black p-0 text-white backdrop:bg-black"
    >
      {open && (
        <div className="flex h-full flex-col">
          {error && (
            <p
              role="alert"
              className="bg-red-950 px-3 py-2 text-xs text-red-200"
            >
              {error}
            </p>
          )}
          <div
            className="relative min-h-0 flex-1 overflow-hidden"
            onTouchStart={(event) => {
              if (tool !== "off") return;
              touchStart.current = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY,
              };
            }}
            onTouchEnd={(event) => {
              const start = touchStart.current;
              touchStart.current = null;
              if (!start || tool !== "off") return;
              const dx = event.changedTouches[0].clientX - start.x,
                dy = event.changedTouches[0].clientY - start.y;
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy))
                navigate(dx < 0 ? 1 : -1);
            }}
            onClick={() => {
              if (blackout) {
                setBlackout(false);
                return;
              }
            }}
          >
            {deck.kind === "html" ? (
              <PresentationHtml
                source={deck.source}
                scripts={deck.allowScripts}
                annotationKey={`${documentId}:html`}
              />
            ) : (
              <SlideSurface
                slide={slides[active]}
                deck={deck}
                step={step}
                laser={laser}
                animate
                animationKey={`${documentId}:${active}`}
                direction={direction}
                annotationKey={`${documentId}:${deck.slideIds?.[active] || active}`}
              />
            )}
            {!blackout && (
              <PresentationInk
                documentId={documentId}
                slideId={deck.slideIds?.[active] || active}
                fullViewport={deck.kind === "html"}
                tool={tool}
                color={color}
                width={width}
                blank={blank}
                clearVersion={clearVersion}
                undoVersion={undoVersion}
              />
            )}
            {blackout && (
              <div
                className="absolute inset-0 bg-black"
                aria-label="Screen blacked out"
              />
            )}
            {overview && (
              <div
                aria-label="Slide overview"
                className="absolute inset-0 grid grid-cols-2 content-start gap-4 overflow-auto bg-neutral-950 p-5 lg:grid-cols-3"
              >
                {slides.map((slide, i) => (
                  <button
                    key={`${i}:${slide.start}`}
                    aria-label={`Go to slide ${i + 1}: ${slide.title}`}
                    onClick={() => jump(i)}
                    className={`overflow-hidden rounded-lg border text-left ${active === i ? "border-blue-500 ring-1 ring-blue-500" : "border-neutral-700"}`}
                  >
                    <div className="pointer-events-none aspect-video">
                      <SlideSurface slide={slide} deck={deck} lazy />
                    </div>
                    <span className="block truncate bg-neutral-900 p-2 text-xs">
                      {i + 1} · {slide.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {help && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
                <section
                  aria-label="Presenter keyboard controls"
                  className="max-h-full w-full max-w-lg overflow-auto rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold">Presenter controls</h2>
                    <button
                      className={button}
                      aria-label="Close presenter controls"
                      onClick={() => setHelp(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    {[
                      ["← / → / Space", "Step or change slide"],
                      ["Home / End", "First / last slide"],
                      ["O", "Slide overview"],
                      ["F", "Fullscreen"],
                      ["L", "Laser pointer"],
                      ["D", "Pen"],
                      ["E", "Eraser (pen active)"],
                      ["1–5", "Pen color"],
                      ["[ / ]", "Pen width"],
                      ["Ctrl/Cmd Z", "Undo stroke"],
                      ["X", "Clear annotations"],
                      ["C", "Blank drawing canvas"],
                      ["B", "Blackout"],
                      ["? / H", "These controls"],
                      ["Esc", "Close a tool, then exit"],
                    ].map(([keys, action]) => (
                      <div key={keys} className="contents">
                        <dt className="font-mono text-blue-300">{keys}</dt>
                        <dd className="text-neutral-300">{action}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 text-xs text-neutral-500">
                    Annotations are per slide and stay in this tab session. They
                    are excluded from exports. Swipe left or right to navigate
                    on touchscreens.
                  </p>
                </section>
              </div>
            )}
          </div>
          <div className="h-0.5 shrink-0 bg-neutral-800">
            <div
              className="h-full bg-blue-500 transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${((active + 1) / slides.length) * 100}%` }}
            />
          </div>
          {tool !== "off" && (
            <div
              aria-label="Presentation pen settings"
              className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-neutral-800 bg-neutral-950 px-3 py-2"
            >
              {colors.map((value, i) => (
                <button
                  key={value}
                  aria-label={`Pen color ${i + 1}`}
                  aria-pressed={color === value}
                  onClick={() => {
                    setColor(value);
                    setTool("pen");
                  }}
                  className={`h-6 w-6 rounded-full border-2 ${color === value ? "border-white ring-1 ring-blue-500" : "border-neutral-600"}`}
                  style={{ background: value }}
                />
              ))}
              <label className="ml-2 flex items-center gap-2 text-xs text-neutral-400">
                Width
                <input
                  aria-label="Presentation pen width"
                  type="number"
                  min={1}
                  value={width}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value) && value > 0) setWidth(value);
                  }}
                  className="w-14 rounded border border-neutral-700 bg-neutral-900 p-1"
                />
              </label>
              <button
                className={button}
                aria-pressed={tool === "eraser"}
                onClick={() =>
                  setTool((value) => (value === "eraser" ? "pen" : "eraser"))
                }
              >
                <Eraser size={14} />
                Eraser
              </button>
              <button
                className={button}
                aria-label="Undo annotation"
                onClick={() => setUndo((value) => value + 1)}
              >
                <Undo2 size={14} />
              </button>
              <button
                className={button}
                aria-label="Clear annotations"
                onClick={() => setClear((value) => value + 1)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
          <footer className="flex shrink-0 flex-wrap items-center justify-center gap-2 bg-neutral-950 px-3 py-2">
            {deck.kind !== "html" && (
              <>
                <button
                  className={button}
                  aria-label="Previous presentation step"
                  disabled={active === 0 && step === 0}
                  onClick={() => navigate(-1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-neutral-400">
                  {active + 1} / {slides.length}
                </span>
                <button
                  className={button}
                  aria-label="Next presentation step"
                  disabled={
                    active === slides.length - 1 &&
                    step >= revealCount(slides[active].source)
                  }
                  onClick={() => navigate(1)}
                >
                  <ChevronRight size={14} />
                </button>
              </>
            )}
            <div
              role="group"
              aria-label="Rehearsal timer"
              className="flex items-center gap-1 rounded border border-neutral-800 px-2 py-1"
            >
              <span
                aria-label="Elapsed presentation time"
                className="min-w-10 text-xs tabular-nums text-neutral-300"
              >
                {Math.floor(elapsed / 60)}:
                {String(elapsed % 60).padStart(2, "0")}
              </span>
              <button
                className={button}
                aria-label={
                  clockRunning
                    ? "Pause rehearsal timer"
                    : "Resume rehearsal timer"
                }
                onClick={() => setClockRunning((value) => !value)}
              >
                {clockRunning ? "Pause" : "Resume"}
              </button>
              <button
                className={button}
                aria-label="Reset rehearsal timer"
                onClick={() => setElapsed(0)}
              >
                Reset
              </button>
              <select
                aria-label="Presentation time goal"
                value={timeGoal}
                onChange={(event) => setTimeGoal(Number(event.target.value))}
                className="max-w-24 rounded border border-neutral-700 bg-neutral-900 p-1 text-xs"
              >
                <option value={0}>No time goal</option>
                {[5, 10, 15, 20, 30, 45, 60].map((minutes) => (
                  <option key={minutes} value={minutes * 60}>
                    {minutes} min
                  </option>
                ))}
              </select>
              {timeGoal > 0 && (
                <span
                  aria-label="Time remaining"
                  className={`whitespace-nowrap text-[10px] tabular-nums ${elapsed >= timeGoal ? "text-red-300" : "text-neutral-400"}`}
                >
                  {elapsed >= timeGoal ? "Over by " : "Left "}
                  {Math.floor(Math.abs(timeGoal - elapsed) / 60)}:
                  {String(Math.abs(timeGoal - elapsed) % 60).padStart(2, "0")}
                </span>
              )}
            </div>
            <button
              className={button}
              disabled={deck.kind === "html"}
              aria-pressed={overview}
              onClick={() => setOverview((value) => !value)}
            >
              <Grid2X2 size={14} />
              <span className="hidden sm:inline">Overview</span>
            </button>
            <button
              className={button}
              aria-pressed={laser}
              onClick={() => {
                setLaser((value) => !value);
                setTool("off");
              }}
            >
              Laser
            </button>
            <button
              className={button}
              aria-pressed={tool !== "off"}
              onClick={() => {
                setTool((value) => (value === "off" ? "pen" : "off"));
                setLaser(false);
              }}
            >
              <Pencil size={14} />
              Pen
            </button>
            <button
              className={button}
              aria-pressed={blank}
              onClick={toggleBlank}
            >
              Canvas
            </button>
            <button
              className={button}
              aria-pressed={blackout}
              onClick={() => setBlackout((value) => !value)}
            >
              Blackout
            </button>
            <button
              className={button}
              aria-label="Presenter controls"
              onClick={() => setHelp((value) => !value)}
            >
              <HelpCircle size={14} />
            </button>
            <button
              className={button}
              aria-label="Fullscreen presentation"
              onClick={full}
            >
              <Maximize size={14} />
            </button>
            <button className={button} onClick={close}>
              <X size={14} />
              Exit
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
}
