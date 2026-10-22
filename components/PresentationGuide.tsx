"use client";
import { useEffect, useRef, useState } from "react";
import {
  X,
  Search,
  ArrowRight,
  Copy,
  Plus,
  LockKeyhole,
  Image as ImageIcon,
  Play,
} from "lucide-react";
import {
  GUIDE_EXAMPLES,
  GUIDE_GROUPS,
  EDITOR_SHORTCUTS,
  PRESENTER_SHORTCUTS,
  GUIDE_FAQ,
  type GuideGroup,
} from "@/lib/presentations/guide";
import { parseSlides, revealCount, type Deck } from "@/lib/presentations/model";
import { SlideSurface } from "./PresentationSlide";
export type GuideAction =
  "starters" | "organize" | "design" | "present" | "checks";
const sections = [
  "Start here",
  "Writing examples",
  "Present & export",
  "Shortcuts",
  "Troubleshooting",
] as const;
const button =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-700 px-3 py-2 text-xs hover:bg-neutral-800 focus-visible:outline-blue-500 disabled:opacity-40";
export function PresentationGuide({
  deck,
  onClose,
  onInsert,
  onAction,
}: {
  deck: Deck;
  onClose: () => void;
  onInsert: (source: string) => void;
  onAction: (action: GuideAction) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    search = useRef<HTMLInputElement>(null);
  const [section, setSection] =
      useState<(typeof sections)[number]>("Start here"),
    [query, setQuery] = useState(""),
    [group, setGroup] = useState<GuideGroup>("All examples"),
    [selected, setSelected] = useState("Headings and emphasis"),
    [step, setStep] = useState(Infinity),
    [copyMessage, setCopyMessage] = useState("");
  const examples = GUIDE_EXAMPLES.filter(
    (item) =>
      (group === "All examples" || item.group === group) &&
      `${item.title} ${item.description} ${item.source}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const example =
    examples.find((item) => item.title === selected) || examples[0];
  const exampleSource = example?.source || "";
  const parsed = parseSlides(exampleSource),
    preview = parsed.find((slide) =>
      slide.source.replace(/<!--[\s\S]*?-->/g, "").trim(),
    ) || {
      ...parsed[0],
      source:
        parsed[0].source +
        "\n\n## Your slide\n\nYour message stays in the spotlight.",
    };
  const reveals = revealCount(preview.source);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    if (!copyMessage) return;
    const timer = setTimeout(() => setCopyMessage(""), 2000);
    return () => clearTimeout(timer);
  }, [copyMessage]);
  const selectExample = (title: string) => {
    setSelected(title);
    setStep(Infinity);
    setCopyMessage("");
  };
  const action = (value: GuideAction) => {
    onClose();
    onAction(value);
  };
  return (
    <dialog
      ref={dialog}
      aria-label="Presentation writing guide"
      onKeyDown={(event) => {
        if (
          !event.nativeEvent.isComposing &&
          (event.ctrlKey || event.metaKey) &&
          event.key === "/"
        ) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      onCancel={onClose}
      onClose={onClose}
      className="m-auto h-[min(820px,90dvh)] max-h-[90dvh] w-[min(1040px,96vw)] overflow-hidden rounded-xl border border-neutral-700 bg-[#18181b] p-0 text-neutral-200 backdrop:bg-black/70"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-800 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-lg font-semibold">Presentation guide</h2>
            <p className="mt-1 text-xs text-neutral-400">
              Learn the basics, see the result, and add it to your own
              presentation.
            </p>
          </div>
          <button
            autoFocus
            className={button}
            aria-label="Close writing guide"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <nav
          aria-label="Guide sections"
          className="flex shrink-0 flex-wrap gap-1 border-b border-neutral-800 p-2 sm:px-4"
        >
          {sections.map((value) => (
            <button
              key={value}
              aria-pressed={section === value}
              onClick={() => setSection(value)}
              className={`${button} ${section === value ? "border-blue-500 bg-blue-500/10 text-blue-200" : "border-transparent text-neutral-400"}`}
            >
              {value}
            </button>
          ))}
        </nav>
        {section === "Writing examples" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-wrap gap-2 border-b border-neutral-800 p-3">
              <div className="flex min-w-0 flex-[1_1_200px] items-center gap-2 rounded-md border border-neutral-700 bg-neutral-950 px-3 focus-within:border-blue-500">
                <Search size={15} className="shrink-0 text-neutral-500" />
                <input
                  ref={search}
                  aria-label="Search writing examples"
                  placeholder="Search headings, images, reveals…"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setStep(Infinity);
                  }}
                  className="min-w-0 flex-1 bg-transparent py-2 text-xs outline-none"
                />
                {query && (
                  <button
                    className="rounded p-1 hover:bg-neutral-800"
                    aria-label="Clear example search"
                    onClick={() => {
                      setQuery("");
                      search.current?.focus();
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <select
                aria-label="Writing example category"
                value={group}
                onChange={(event) => {
                  setGroup(event.target.value as GuideGroup);
                  setStep(Infinity);
                }}
                className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-2 text-xs"
              >
                {GUIDE_GROUPS.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </div>
            {example ? (
              <div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-[240px_1fr] md:overflow-hidden">
                <label className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2 text-xs text-neutral-400 md:hidden">
                  Example
                  <select
                    aria-label="Choose writing example"
                    value={example.title}
                    onChange={(event) => selectExample(event.target.value)}
                    className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-2 text-neutral-200"
                  >
                    {examples.map((item) => (
                      <option key={item.title}>{item.title}</option>
                    ))}
                  </select>
                </label>
                <nav
                  aria-label="Writing examples"
                  className="hidden min-h-0 overflow-auto border-r border-neutral-800 p-2 md:block"
                >
                  {examples.map((item) => (
                    <button
                      key={item.title}
                      aria-pressed={example.title === item.title}
                      onClick={() => selectExample(item.title)}
                      className={`block w-full rounded-md px-3 py-2.5 text-left text-xs hover:bg-neutral-800 focus-visible:outline-blue-500 ${example.title === item.title ? "bg-blue-500/10 text-blue-200" : "text-neutral-300"}`}
                    >
                      <span className="block font-medium">{item.title}</span>
                      <span className="mt-1 block text-[10px] text-neutral-500">
                        {item.group}
                      </span>
                    </button>
                  ))}
                </nav>
                <article className="min-w-0 p-4 md:overflow-auto sm:p-5">
                  <h3 className="text-base font-semibold">{example.title}</h3>
                  <p className="mt-1 text-xs leading-6 text-neutral-400">
                    {example.description}
                  </p>
                  <div className="my-3 flex flex-wrap items-center gap-2">
                    <button
                      className={`${button} border-blue-600 bg-blue-600 text-white hover:bg-blue-500`}
                      onClick={() => onInsert(example.source)}
                    >
                      <Plus size={14} />
                      Insert example
                    </button>
                    <button
                      className={button}
                      onClick={() =>
                        void (async () => {
                          try {
                            await navigator.clipboard.writeText(
                              example.source.trim(),
                            );
                            setCopyMessage("Copied Markdown");
                          } catch {
                            setCopyMessage(
                              "Copy unavailable. Select the Markdown below to copy it.",
                            );
                          }
                        })()
                      }
                    >
                      <Copy size={14} />
                      Copy Markdown
                    </button>
                    <span
                      role="status"
                      className="min-h-4 text-[10px] text-neutral-400"
                    >
                      {copyMessage}
                    </span>
                  </div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                    What you get
                  </p>
                  {example.title === "Speaker notes" ? (
                    <div className="rounded-lg border border-neutral-700 p-4 text-xs leading-6">
                      <LockKeyhole size={18} className="mb-2 text-blue-300" />
                      Your reminder stays private. You can also type normally in
                      Speaker notes below the preview, without writing this
                      command.
                    </div>
                  ) : example.media ? (
                    <div className="rounded-lg border border-neutral-700 p-4 text-xs leading-6">
                      <ImageIcon size={22} className="mb-2 text-blue-300" />
                      Use your own uploaded image or media URL in the example.
                      Sample URLs are placeholders; this guide does not load
                      external media.
                      <p className="mt-2 text-neutral-400">
                        For images, use the Image toolbar button first. The
                        title can add <code>left</code>, <code>right</code>, or{" "}
                        <code>bg opacity:0.25</code> placement.
                      </p>
                    </div>
                  ) : (
                    <div className="aspect-video w-full max-w-[480px] overflow-hidden rounded-lg border border-neutral-700">
                      <SlideSurface
                        key={example.title}
                        slide={preview}
                        deck={deck}
                        step={step}
                      />
                    </div>
                  )}
                  {reveals > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <button className={button} onClick={() => setStep(0)}>
                        Replay reveals
                      </button>
                      <button
                        className={button}
                        disabled={step >= reveals}
                        onClick={() => setStep((value) => value + 1)}
                      >
                        Next reveal
                      </button>
                      <span className="text-[10px] text-neutral-500">
                        {step === Infinity
                          ? "All steps shown"
                          : `Step ${step} of ${reveals}`}
                      </span>
                    </div>
                  )}
                  <p className="mb-2 mt-4 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                    Markdown to write
                  </p>
                  <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-[11px] leading-6 text-neutral-300">
                    <code>{example.source.trim()}</code>
                  </pre>
                  <p className="mt-2 text-[10px] leading-5 text-neutral-500">
                    Insert adds this at your last editor selection. Replace the
                    example wording with your own.
                  </p>
                </article>
              </div>
            ) : (
              <div
                role="status"
                className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-neutral-400"
              >
                <p>
                  No writing examples match “{query.trim()}” in{" "}
                  {group.toLowerCase()}.
                </p>
                <button
                  className={button}
                  onClick={() => {
                    setQuery("");
                    setGroup("All examples");
                    search.current?.focus();
                  }}
                >
                  Reset search and category
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
            {section === "Start here" && (
              <>
                <div className="mb-5 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                  <h3 className="font-semibold">
                    From an idea to a presentation
                  </h3>
                  <p className="mt-1 text-xs leading-6 text-neutral-400">
                    Write in Markdown and watch the preview update. You can
                    start with an outline, then make every slide your own.
                  </p>
                </div>
                <ol className="grid gap-3 md:grid-cols-3">
                  {[
                    {
                      title: "Choose a structure",
                      description:
                        "Use a ready-made outline for a lesson, update, pitch, demo, workshop, or decision.",
                      label: "Explore starters",
                      run: () => action("starters"),
                    },
                    {
                      title: "Write one clear idea",
                      description:
                        "Use # for titles, - for bullets, and --- on its own line for a new slide.",
                      label: "Try writing examples",
                      run: () => setSection("Writing examples"),
                    },
                    {
                      title: "Rehearse your delivery",
                      description:
                        "Add private notes below the preview. Present with a timer, laser pointer, or drawing pen.",
                      label: "Present this deck",
                      run: () => action("present"),
                    },
                  ].map(({ title, description, label, run }, index) => (
                    <li
                      key={title}
                      className="flex flex-col rounded-lg border border-neutral-700 p-4"
                    >
                      <span className="mb-3 text-xs text-blue-300">
                        Step {index + 1}
                      </span>
                      <h3 className="text-sm font-medium">{title}</h3>
                      <p className="mb-4 mt-2 flex-1 text-xs leading-6 text-neutral-400">
                        {description}
                      </p>
                      <button className={button} onClick={run}>
                        {label}
                        <ArrowRight size={13} />
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button className={button} onClick={() => action("organize")}>
                    Organize your slides
                  </button>
                  <button className={button} onClick={() => action("design")}>
                    Adjust design & motion
                  </button>
                  <button className={button} onClick={() => action("checks")}>
                    Check your slides
                  </button>
                </div>
                <p className="mt-5 flex items-start gap-2 text-xs leading-6 text-neutral-400">
                  <LockKeyhole size={15} className="mt-1 shrink-0" />
                  Your presentation saves on this device. Export a Presentation
                  backup to keep an editable copy elsewhere.
                </p>
              </>
            )}
            {section === "Present & export" && (
              <div className="space-y-5 text-xs leading-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-neutral-700 p-4">
                    <h3 className="text-sm font-semibold">One screen or two</h3>
                    <p className="mt-2 text-neutral-400">
                      Present opens an expanded audience view. Audience window
                      opens a separate window so your editor can follow the
                      current slide and keep speaker notes private. Move that
                      window to a second screen and use Fullscreen.
                    </p>
                    <button
                      className={`${button} mt-3`}
                      onClick={() => action("present")}
                    >
                      <Play size={13} />
                      Present this deck
                    </button>
                  </div>
                  <div className="rounded-lg border border-neutral-700 p-4">
                    <h3 className="text-sm font-semibold">
                      Make delivery feel natural
                    </h3>
                    <p className="mt-2 text-neutral-400">
                      Use reveals for one point at a time. Pause or reset the
                      rehearsal timer and choose a time goal. Use the laser or
                      pen to explain, a blank drawing surface to explore, and
                      blackout to bring attention back to you.
                    </p>
                  </div>
                </div>
                <h3 className="text-sm font-semibold">
                  Choose the right export
                </h3>
                <div className="overflow-auto rounded-lg border border-neutral-700">
                  <table className="w-full min-w-[380px] text-left">
                    <thead className="bg-neutral-900 text-neutral-300">
                      <tr>
                        <th scope="col" className="p-3">
                          Format
                        </th>
                        <th scope="col" className="p-3">
                          Best for
                        </th>
                        <th scope="col" className="p-3">
                          Speaker notes
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["PDF", "Static slides to share or print", "Excluded"],
                        [
                          "Standalone HTML",
                          "Reveals and presenter tools in a browser",
                          "Excluded",
                        ],
                        [
                          "Presentation backup",
                          "Editable source and all deck settings",
                          "Included",
                        ],
                        [
                          "Markdown source",
                          "Editing the writing in another tool",
                          "Included",
                        ],
                      ].map((row) => (
                        <tr
                          key={row[0]}
                          className="border-t border-neutral-800"
                        >
                          {row.map((cell) => (
                            <td key={cell} className="p-3 text-neutral-400">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-neutral-400">
                  HTML embeds presentation fonts and uploaded images. Remote
                  media still needs internet; videos and embeds are not
                  interactive in PDF. HTML documents use browser print for PDF.
                </p>
                <p className="rounded-lg border border-neutral-700 p-3 text-neutral-400">
                  Presentations have their own local library and backups. They
                  are separate from canvas/notes project backups and are not
                  synchronized through rooms. Session highlights, comments, and
                  pen strokes stay out of exported content.
                </p>
              </div>
            )}
            {section === "Shortcuts" && (
              <div className="grid gap-5 md:grid-cols-2">
                {[
                  { title: "While editing", rows: EDITOR_SHORTCUTS },
                  { title: "While presenting", rows: PRESENTER_SHORTCUTS },
                ].map(({ title, rows }) => (
                  <section key={title}>
                    <h3 className="mb-3 text-sm font-semibold">{title}</h3>
                    <dl className="divide-y divide-neutral-800 rounded-lg border border-neutral-700 px-3">
                      {rows.map(([keys, description]) => (
                        <div key={keys} className="py-3">
                          <dt className="text-xs text-blue-200">
                            <kbd>{keys}</kbd>
                          </dt>
                          <dd className="mt-1 text-xs leading-5 text-neutral-400">
                            {description}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
                <p className="text-xs leading-6 text-neutral-500 md:col-span-2">
                  Use ⌘ on macOS or Ctrl on Windows/Linux. Editor formatting
                  applies while the Markdown field is focused. Typing and input
                  composition keep their normal behavior. Presenter controls
                  also work with buttons and touch.
                </p>
              </div>
            )}
            {section === "Troubleshooting" && (
              <div className="space-y-3">
                {GUIDE_FAQ.map(([title, body]) => (
                  <details
                    key={title}
                    className="rounded-lg border border-neutral-700 p-4"
                  >
                    <summary className="cursor-pointer text-sm font-medium">
                      {title}
                    </summary>
                    <p className="mt-3 text-xs leading-6 text-neutral-400">
                      {body}
                    </p>
                  </details>
                ))}
                <button
                  className={`${button} mt-3`}
                  onClick={() => action("checks")}
                >
                  Check this presentation
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
