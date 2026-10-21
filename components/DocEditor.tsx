"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Table2,
  StickyNote,
  Link2,
  Undo2,
  Redo2,
  Search,
  X,
  ArrowUp,
  ArrowDown,
  Copy,
  ListTree,
  Code2,
  Plus,
  PanelTopClose,
  Maximize2,
  Minimize2,
  FileDown,
  Network,
} from "lucide-react";
import { MarkdownNotesEditor } from "./MarkdownNotesEditor";
import {
  NoteTypographyTools,
  NoteInlineStyleTools,
  NoteStylePanel,
  type NotePanel,
} from "./NoteDocumentTools";
import { NoteLinksPanel } from "./NoteLinksPanel";
import { NoteInsertMenu, type NoteCommand } from "./NoteInsertMenu";
import { safeFilename } from "@/lib/projectFile";
import { loadPreferences, savePreferences } from "@/lib/preferences";
import {
  NOTE_TEMPLATES,
  NOTE_FONTS,
  readNoteHref,
  type NotePage,
} from "@/lib/notesDocument";
import { fontCssStack } from "@/draw/fonts";
import {
  richNotesExtensions,
  richNoteMatches,
  noteSearchKey,
  safeNoteLink,
  insertStickyNote,
  serializeRichNotes,
  insertToggleSection,
  insertNoteTemplate,
  insertInternalNoteLink,
  duplicateNoteBlock,
  moveNoteBlock,
  notesToSafeHtml,
  applyRemoteNotes,
} from "@/lib/richNotes";

interface DocEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExportMarkdown: () => void;
  noteId?: string;
  title?: string;
  getNotes?: () => NotePage[];
  onOpenNote?: (id: string) => boolean;
  onCreateNote?: (title: string) => NotePage;
  theme: "dark" | "light";
  focusRange?: { start: number; end: number };
}
export function DocEditor(props: DocEditorProps) {
  const [source, setSource] = useState(false);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      {source ? (
        <>
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 bg-[#18181b] px-3 py-2 text-xs text-neutral-400">
            <span>Markdown source</span>
            <button
              type="button"
              className="rounded px-2 py-1 text-blue-400 hover:bg-neutral-800"
              onClick={() => setSource(false)}
            >
              Back to writing
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <MarkdownNotesEditor {...props} />
          </div>
        </>
      ) : (
        <RichNotesEditor {...props} onSource={() => setSource(true)} />
      )}
    </div>
  );
}
function RichNotesEditor({
  value,
  onChange,
  onExportMarkdown,
  focusRange,
  onSource,
  noteId,
  title,
  getNotes,
  onOpenNote,
  onCreateNote,
}: DocEditorProps & { onSource: () => void }) {
  const change = useRef(onChange),
    latest = useRef(value),
    published = useRef(value);
  useEffect(() => {
    change.current = onChange;
    latest.current = value;
  }, [onChange, value]);
  const root = useRef<HTMLElement>(null);
  const [extensions] = useState(richNotesExtensions);
  const [appearance, setAppearance] = useState(
    () => loadPreferences().noteAppearance,
  );
  const [panel, setPanel] = useState<NotePanel>(null),
    [pages, setPages] = useState<NotePage[]>([]),
    [writingFocus, setWritingFocus] = useState(false);
  const [manualMenu, setManualMenu] = useState(false),
    [blockQuery, setBlockQuery] = useState(""),
    [dismissedSlash, setDismissedSlash] = useState<number | null>(null);
  const [menuSelection, setMenuSelection] = useState({ query: "", index: 0 }),
    [menuPosition, setMenuPosition] = useState({ top: 88, left: 8 });
  useEffect(() => {
    savePreferences({ noteAppearance: appearance });
  }, [appearance]);
  const [find, setFind] = useState(false),
    [query, setQuery] = useState(""),
    [replacement, setReplacement] = useState(""),
    [matchCase, setMatchCase] = useState(false),
    [active, setActive] = useState(-1);
  const [outline, setOutline] = useState(false),
    [linkOpen, setLinkOpen] = useState(false),
    [link, setLink] = useState(""),
    [linkError, setLinkError] = useState(""),
    [notice, setNotice] = useState("");
  const findInput = useRef<HTMLInputElement>(null),
    linkInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions,
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "Board notes",
        role: "textbox",
        "aria-multiline": "true",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      const next = serializeRichNotes(editor);
      published.current = next;
      change.current(next);
    },
  });
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            font: editor.getAttributes("textStyle").fontFamily,
            size: editor.getAttributes("textStyle").fontSize,
            underline: editor.isActive("underline"),
            highlight: editor.isActive("highlight"),
            superscript: editor.isActive("superscript"),
            subscript: editor.isActive("subscript"),
            slash: (() => {
              const { $from, empty } = editor.state.selection;
              if (
                !empty ||
                !["paragraph", "heading"].includes($from.parent.type.name)
              )
                return null;
              const before = editor.state.doc.textBetween(
                Math.max($from.start(), $from.pos - 80),
                $from.pos,
                "",
                "",
              );
              const match = before.match(/(?:^|\s)\/([a-zA-Z ]{0,40})$/);
              return match
                ? {
                    from: $from.pos - match[1].length - 1,
                    to: $from.pos,
                    query: match[1],
                  }
                : null;
            })(),
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            strike: editor.isActive("strike"),
            bullet: editor.isActive("bulletList"),
            ordered: editor.isActive("orderedList"),
            task: editor.isActive("taskList"),
            quote: editor.isActive("blockquote"),
            code: editor.isActive("codeBlock"),
            table: editor.isActive("table"),
            link: editor.isActive("link"),
            heading: editor.isActive("heading")
              ? String(editor.getAttributes("heading").level)
              : "0",
            undo: editor.can().undo(),
            redo: editor.can().redo(),
            text: editor.getText(),
            headings: (() => {
              const result: { pos: number; text: string; level: number }[] = [];
              editor.state.doc.descendants((node, pos) => {
                if (node.type.name === "heading")
                  result.push({
                    pos,
                    text: node.textContent,
                    level: node.attrs.level,
                  });
              });
              return result;
            })(),
            matches: richNoteMatches(editor.state.doc, query, matchCase),
          }
        : null,
  });
  const matches = state?.matches ?? [],
    index = matches.length
      ? Math.min(Math.max(active, 0), matches.length - 1)
      : -1;
  useEffect(() => {
    if (!editor || value === published.current) return;
    applyRemoteNotes(editor, value);
    published.current = value;
  }, [editor, value]);
  useEffect(() => {
    if (editor)
      editor.view.dispatch(
        editor.state.tr.setMeta(noteSearchKey, {
          query: find ? query : "",
          matchCase,
          active: index,
        }),
      );
  }, [editor, query, find, matchCase, index]);
  useEffect(() => {
    if (find) findInput.current?.focus();
  }, [find]);
  useEffect(() => {
    if (linkOpen) linkInput.current?.focus();
  }, [linkOpen]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!editor || !focusRange) return;
    // Board search uses Markdown offsets. Find the selected readable text in the visual document.
    const needle = latest.current
      .slice(focusRange.start, focusRange.end)
      .replace(/^#{1,6}\s+/, "");
    const match = richNoteMatches(editor.state.doc, needle)[0];
    if (match)
      editor.chain().focus().setTextSelection(match).scrollIntoView().run();
  }, [editor, focusRange]);
  const openFind = () => {
    setFind(true);
    findInput.current?.focus();
  };
  const jump = (direction = 1) => {
    if (!editor || !matches.length) return;
    const next =
      active < 0
        ? direction < 0
          ? matches.length - 1
          : 0
        : (index + direction + matches.length) % matches.length;
    setActive(next);
    editor.chain().setTextSelection(matches[next]).scrollIntoView().run();
  };
  const replace = (all = false) => {
    if (!editor || !matches.length) return;
    const targets = all ? matches : [matches[Math.max(0, index)]];
    const tr = editor.state.tr;
    for (const match of [...targets].reverse()) {
      if (replacement) tr.insertText(replacement, match.from, match.to);
      else tr.delete(match.from, match.to);
    }
    editor.view.dispatch(tr);
    setActive(-1);
    setNotice(
      `Replaced ${targets.length} ${targets.length === 1 ? "match" : "matches"}.`,
    );
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(editor?.getText() || "");
      setNotice("Notes copied.");
    } catch {
      setNotice("Could not copy. Select your notes and copy again.");
    }
  };
  const closeLink = () => {
    setLinkOpen(false);
    editor?.commands.focus();
  };
  const applyLink = () => {
    const href = safeNoteLink(link);
    if (!href) {
      setLinkError("Enter a valid https, http or email link.");
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
    closeLink();
  };
  const openPanel = (next: NotePanel) => {
    setManualMenu(false);
    if (state?.slash) setDismissedSlash(state.slash.from);
    setPanel((current) => (current === next ? null : next));
    if (next === "links") setPages(getNotes?.() || []);
  };
  const closeMenu = () => {
    setManualMenu(false);
    if (state?.slash) setDismissedSlash(state.slash.from);
    editor?.commands.focus();
  };
  const slash = state?.slash,
    slashMenu =
      !!slash && slash.from !== dismissedSlash && !editor?.view.composing;
  const menuOpen = manualMenu || slashMenu,
    effectiveQuery = manualMenu ? blockQuery : slash?.query || "";
  const commands: NoteCommand[] = [
    {
      id: "paragraph",
      label: "Normal text",
      description: "A plain paragraph.",
      group: "Text",
      run: () => {
        editor?.chain().focus().setParagraph().run();
      },
    },
    ...([1, 2, 3] as const).map((level) => ({
      id: `heading-${level}`,
      label: `Heading ${level}`,
      description:
        level === 1
          ? "A large section heading."
          : "Organize your document into sections.",
      group: "Text",
      run: () => {
        editor?.chain().focus().setHeading({ level }).run();
      },
    })),
    {
      id: "bullet",
      label: "Bullet list",
      description: "A list of ideas.",
      group: "Lists",
      run: () => {
        editor?.chain().focus().toggleBulletList().run();
      },
    },
    {
      id: "numbered",
      label: "Numbered list",
      description: "Steps in a sequence.",
      group: "Lists",
      run: () => {
        editor?.chain().focus().toggleOrderedList().run();
      },
    },
    {
      id: "task",
      label: "Checklist",
      description: "Tasks you can check off.",
      group: "Lists",
      run: () => {
        editor?.chain().focus().toggleTaskList().run();
      },
    },
    {
      id: "sticky",
      label: "Sticky note",
      description: "An editable note card that keeps selected writing.",
      group: "Blocks",
      run: () => {
        if (editor) insertStickyNote(editor);
      },
    },
    {
      id: "toggle",
      label: "Toggle section",
      description: "Collapsible notes with an editable title.",
      group: "Blocks",
      run: () => {
        if (editor) insertToggleSection(editor);
      },
    },
    {
      id: "table",
      label: "Table",
      description: "A table with header, row and column controls.",
      group: "Blocks",
      run: () => {
        editor
          ?.chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    {
      id: "quote",
      label: "Quote",
      description: "Highlight a quotation or thought.",
      group: "Blocks",
      run: () => {
        editor?.chain().focus().toggleBlockquote().run();
      },
    },
    {
      id: "code",
      label: "Code block",
      description: "Code in a monospaced block.",
      group: "Blocks",
      run: () => {
        editor?.chain().focus().toggleCodeBlock().run();
      },
    },
    {
      id: "inline-code",
      label: "Inline code",
      description: "A short code fragment in your paragraph.",
      group: "Text",
      run: () => {
        editor?.chain().focus().toggleCode().run();
      },
    },
    {
      id: "divider",
      label: "Divider",
      description: "A horizontal section break.",
      group: "Blocks",
      run: () => {
        editor?.chain().focus().setHorizontalRule().run();
      },
    },
    {
      id: "note-link",
      label: "Link to a note",
      description: "Link another note and discover backlinks.",
      group: "Knowledge",
      run: () => openPanel("links"),
    },
    ...NOTE_TEMPLATES.map((template) => ({
      id: `template-${template.id}`,
      label: template.name,
      description: template.description,
      group: "Templates",
      run: () => {
        if (editor) insertNoteTemplate(editor, template.content);
      },
    })),
    {
      id: "duplicate",
      label: "Duplicate block",
      description: "Copy the current top-level block.",
      group: "Edit",
      run: () => {
        if (editor) duplicateNoteBlock(editor);
      },
    },
    {
      id: "move-up",
      label: "Move block up",
      description: "Move the current block before the previous one.",
      group: "Edit",
      run: () => {
        if (editor && !moveNoteBlock(editor, -1))
          setNotice("This block is already first.");
      },
    },
    {
      id: "move-down",
      label: "Move block down",
      description: "Move the current block after the next one.",
      group: "Edit",
      run: () => {
        if (editor && !moveNoteBlock(editor, 1))
          setNotice("This block is already last.");
      },
    },
    {
      id: "delete",
      label: "Delete block",
      description: "Remove the current block. Undo restores it.",
      group: "Edit",
      run: () => {
        if (editor) {
          const { $from } = editor.state.selection;
          if ($from.depth)
            editor
              .chain()
              .focus()
              .deleteRange({ from: $from.before(1), to: $from.after(1) })
              .run();
        }
      },
    },
  ];
  const filteredCommands = commands.filter((command) =>
    `${command.label} ${command.description} ${command.group}`
      .toLowerCase()
      .includes(effectiveQuery.trim().toLowerCase()),
  );
  const commandIndex =
    menuSelection.query === effectiveQuery
      ? Math.min(menuSelection.index, Math.max(0, filteredCommands.length - 1))
      : 0;
  const runCommand = (command: NoteCommand) => {
    if (slashMenu && !manualMenu && slash)
      editor?.commands.deleteRange({ from: slash.from, to: slash.to });
    setManualMenu(false);
    setDismissedSlash(slash?.from ?? null);
    command.run();
  };
  useLayoutEffect(() => {
    if (!menuOpen || !root.current || !editor) return;
    const element = root.current;
    const update = () => {
      const box = element.getBoundingClientRect(),
        caret = slashMenu
          ? editor.view.coordsAtPos(editor.state.selection.from)
          : null;
      const position = {
        left: caret
          ? Math.max(8, Math.min(caret.left - box.left, box.width - 336))
          : 8,
        top: caret
          ? Math.max(88, Math.min(caret.bottom - box.top + 8, box.height - 340))
          : 88,
      };
      setMenuPosition((previous) =>
        previous.left === position.left && previous.top === position.top
          ? previous
          : position,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    document.fonts?.addEventListener("loadingdone", update);
    return () => {
      observer.disconnect();
      document.fonts?.removeEventListener("loadingdone", update);
    };
  }, [editor, menuOpen, slashMenu, slash?.from, slash?.to]);
  useEffect(() => {
    if (!panel && !manualMenu && !slashMenu) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest("[data-note-overlay]") &&
        !target.closest("[data-note-overlay-trigger]")
      ) {
        setPanel(null);
        setManualMenu(false);
        if (slash) setDismissedSlash(slash.from);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [panel, manualMenu, slashMenu, slash]);
  const exportNotes = (format: "html" | "txt") => {
    if (!editor) return;
    const escapedTitle = document.createElement("span");
    escapedTitle.textContent = title || "Notes";
    const text = editor.getText(),
      body =
        format === "html"
          ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapedTitle.innerHTML}</title><style>:root{${NOTE_FONTS.map((font) => `${font.variable}:${font.fallback}`).join(";")}}body{max-width:900px;margin:40px auto;padding:0 24px;background:#18181b;color:#e4e4e7;font-family:${fontCssStack(appearance.font)};font-size:${appearance.size}px;line-height:${appearance.lineHeight};overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}td,th{border:1px solid #52525b;padding:8px}blockquote,details{border-left:3px solid #c7ba91;background:#302d24;padding:16px;border-radius:8px}a{color:#60a5fa}mark{background-color:#665329;color:inherit}pre{padding:16px;background:#121212;white-space:pre-wrap}img{max-width:100%}ul[data-type=taskList]{list-style:none;padding:0}</style></head><body>${notesToSafeHtml(serializeRichNotes(editor))}</body></html>`
          : text;
    const url = URL.createObjectURL(
      new Blob([body], {
        type:
          format === "html"
            ? "text/html;charset=utf-8"
            : "text/plain;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFilename(title || "Notes")}.${format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`${format === "html" ? "HTML" : "Text"} downloaded.`);
  };
  const words = state?.text.trim() ? state.text.trim().split(/\s+/u).length : 0;
  const tools = [
    {
      label: "Bold",
      icon: Bold,
      active: state?.bold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: state?.italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: "Strikethrough",
      icon: Strikethrough,
      active: state?.strike,
      run: () => editor?.chain().focus().toggleStrike().run(),
    },
    {
      label: "Bullet list",
      icon: List,
      active: state?.bullet,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: state?.ordered,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Checklist",
      icon: CheckSquare,
      active: state?.task,
      run: () => editor?.chain().focus().toggleTaskList().run(),
    },
    {
      label: "Quote",
      icon: Quote,
      active: state?.quote,
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "Code block",
      icon: Code,
      active: state?.code,
      run: () => editor?.chain().focus().toggleCodeBlock().run(),
    },
    {
      label: "Insert toggle section",
      icon: PanelTopClose,
      run: () => {
        if (editor) insertToggleSection(editor);
      },
    },
    {
      label: "Insert sticky note",
      icon: StickyNote,
      run: () => {
        if (editor) insertStickyNote(editor);
      },
    },
    {
      label: "Insert table",
      icon: Table2,
      run: () =>
        editor
          ?.chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      label: "Insert divider",
      icon: Minus,
      run: () => editor?.chain().focus().setHorizontalRule().run(),
    },
    {
      label: "Add or edit link",
      icon: Link2,
      active: state?.link,
      run: () => {
        setLink(editor?.getAttributes("link").href || "");
        setLinkError("");
        setLinkOpen(true);
      },
    },
  ];
  return (
    <section
      ref={root}
      aria-label="Notes editor"
      className="relative flex h-full min-h-0 min-w-0 flex-col bg-[#18181b] text-neutral-200"
      onClick={(event) => {
        const anchor = (event.target as HTMLElement).closest("a");
        const id = anchor && readNoteHref(anchor.getAttribute("href") || "");
        if (anchor && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          if (id) {
            if (!onOpenNote?.(id))
              setNotice("This note is unavailable on this device.");
          } else {
            const href = safeNoteLink(anchor.getAttribute("href") || "");
            if (href) window.open(href, "_blank", "noopener,noreferrer");
          }
        }
      }}
      onKeyDownCapture={(event) => {
        if (event.nativeEvent.isComposing || !menuOpen) return;
        const target = event.target as HTMLElement;
        if (
          !target.closest('[contenteditable="true"]') &&
          !target.closest('[aria-label="Search note blocks"]') &&
          !target.closest('[role="option"]')
        )
          return;
        if (["ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          if (filteredCommands.length)
            setMenuSelection({
              query: effectiveQuery,
              index:
                (commandIndex +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  filteredCommands.length) %
                filteredCommands.length,
            });
        } else if (event.key === "Enter" && filteredCommands.length) {
          event.preventDefault();
          event.stopPropagation();
          runCommand(filteredCommands[commandIndex]);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeMenu();
        }
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (
          (event.ctrlKey || event.metaKey) &&
          ["f", "h"].includes(event.key.toLowerCase())
        ) {
          event.preventDefault();
          event.stopPropagation();
          openFind();
        } else if (find && event.key === "F3") {
          event.preventDefault();
          event.stopPropagation();
          jump(event.shiftKey ? -1 : 1);
        } else if (
          event.key === "Escape" &&
          (find || linkOpen || panel || writingFocus)
        ) {
          event.preventDefault();
          event.stopPropagation();
          setFind(false);
          setPanel(null);
          setWritingFocus(false);
          closeLink();
        }
      }}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-1 border-b border-neutral-800 px-3 py-2">
        <h2 className="text-xs font-semibold">Notes</h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="note-tool"
            aria-label={writingFocus ? "Exit writing focus" : "Focus writing"}
            title={writingFocus ? "Show note controls" : "Focus writing"}
            aria-pressed={writingFocus}
            onClick={() => {
              setWritingFocus(!writingFocus);
              setPanel(null);
              setManualMenu(false);
            }}
          >
            {writingFocus ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          {!writingFocus && (
            <>
              <button
                type="button"
                data-note-overlay-trigger
                className="note-tool"
                aria-label="Note links and backlinks"
                title="Note links and backlinks"
                onClick={() => openPanel("links")}
              >
                <Network className="h-4 w-4" />
              </button>
              <button
                type="button"
                data-note-overlay-trigger
                className="note-tool"
                aria-label="Export notes"
                title="Download notes"
                aria-expanded={panel === "export"}
                onClick={() => openPanel("export")}
              >
                <FileDown className="h-4 w-4" />
              </button>

              <button
                type="button"
                className="note-tool"
                title="Find and replace"
                aria-label="Find and replace in notes"
                aria-expanded={find}
                onClick={openFind}
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="note-tool"
                title="Outline"
                aria-label="Show note outline"
                aria-pressed={outline}
                onClick={() => setOutline(!outline)}
              >
                <ListTree className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="note-tool"
                title="Copy notes"
                aria-label="Copy notes"
                onClick={() => void copy()}
              >
                <Copy className="h-4 w-4" />
              </button>

              <button
                type="button"
                className="note-tool"
                title="Optional Markdown source"
                aria-label="Edit Markdown source"
                onClick={onSource}
              >
                <Code2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </header>
      {!writingFocus && (
        <div
          role="toolbar"
          aria-label="Note formatting"
          className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-neutral-800 px-2 py-1 [&>button]:shrink-0"
        >
          <button
            type="button"
            data-note-overlay-trigger
            className="note-tool flex h-8 items-center gap-1 whitespace-nowrap px-2 text-blue-400"
            aria-label="Insert note block"
            title="Insert block or template · type / while writing"
            onClick={() => {
              setManualMenu(!manualMenu);
              setPanel(null);
              setBlockQuery("");
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs">Insert</span>
          </button>
          <select
            aria-label="Paragraph style"
            className="mr-1 w-24 shrink-0 rounded border border-neutral-700 bg-neutral-900 p-1.5 text-xs"
            value={state?.heading || "0"}
            onChange={(e) => {
              const level = Number(e.target.value);
              if (level)
                editor
                  ?.chain()
                  .focus()
                  .setHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
                  .run();
              else editor?.chain().focus().setParagraph().run();
            }}
          >
            <option value="0">Normal text</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
            <option value="4">Heading 4</option>
            <option value="5">Heading 5</option>
            <option value="6">Heading 6</option>
          </select>
          <NoteTypographyTools
            editor={editor}
            appearance={appearance}
            font={state?.font}
            size={state?.size}
          />

          {tools.slice(0, 3).map((t) => (
            <button
              key={t.label}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={t.active}
              disabled={!editor}
              className={`note-tool ${t.active ? "bg-blue-500/15 text-blue-400" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.run}
            >
              <t.icon className="h-4 w-4" />
            </button>
          ))}
          <NoteInlineStyleTools
            editor={editor}
            underline={!!state?.underline}
            highlight={!!state?.highlight}
            superscript={!!state?.superscript}
            subscript={!!state?.subscript}
            onPanel={openPanel}
          />
          {tools.slice(3).map((t) => (
            <button
              key={t.label}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={t.active}
              disabled={!editor}
              className={`note-tool ${t.active ? "bg-blue-500/15 text-blue-400" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.run}
            >
              <t.icon className="h-4 w-4" />
            </button>
          ))}
          <button
            type="button"
            className="note-tool"
            title="Undo"
            aria-label="Undo notes"
            disabled={!state?.undo}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="note-tool"
            title="Redo"
            aria-label="Redo notes"
            disabled={!state?.redo}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>
      )}
      {menuOpen && (
        <div data-note-overlay>
          <NoteInsertMenu
            commands={filteredCommands}
            query={effectiveQuery}
            onQuery={setBlockQuery}
            index={commandIndex}
            onIndex={(index) =>
              setMenuSelection({ query: effectiveQuery, index })
            }
            onRun={runCommand}
            onClose={closeMenu}
            position={menuPosition}
            slash={slashMenu && !manualMenu}
            owner={editor?.view.dom}
          />
        </div>
      )}
      {panel && (
        <div data-note-overlay>
          {panel === "export" && (
            <aside
              role="region"
              aria-label="Export notes"
              className="absolute left-2 top-24 z-40 w-64 max-w-[calc(100%-1rem)] space-y-1 rounded-xl border border-neutral-700 bg-[#18181b] p-3 text-xs shadow-lg"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">Export notes</h3>
                <button
                  type="button"
                  aria-label="Close note export"
                  className="note-tool"
                  onClick={() => setPanel(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                aria-label="Download notes as HTML"
                className="block w-full rounded px-2 py-2 text-left hover:bg-neutral-800"
                onClick={() => {
                  exportNotes("html");
                  setPanel(null);
                }}
              >
                Styled HTML
              </button>
              <button
                type="button"
                aria-label="Download notes as text"
                className="block w-full rounded px-2 py-2 text-left hover:bg-neutral-800"
                onClick={() => {
                  exportNotes("txt");
                  setPanel(null);
                }}
              >
                Plain text
              </button>
              <button
                type="button"
                aria-label="Download notes as Markdown"
                className="block w-full rounded px-2 py-2 text-left hover:bg-neutral-800"
                onClick={() => {
                  onExportMarkdown();
                  setPanel(null);
                }}
              >
                Markdown
              </button>
            </aside>
          )}
          <NoteStylePanel
            panel={panel}
            editor={editor}
            appearance={appearance}
            onAppearance={setAppearance}
            onClose={() => {
              setPanel(null);
              editor?.commands.focus();
            }}
          />
          {panel === "links" && (
            <NoteLinksPanel
              noteId={noteId}
              value={value}
              pages={pages}
              onInsert={(page) => {
                if (editor) insertInternalNoteLink(editor, page.id, page.title);
                setPanel(null);
              }}
              onOpen={onOpenNote}
              onCreate={onCreateNote}
              onClose={() => {
                setPanel(null);
                editor?.commands.focus();
              }}
            />
          )}
        </div>
      )}
      {state?.table && !writingFocus && (
        <div
          role="toolbar"
          aria-label="Table options"
          className="flex shrink-0 flex-wrap gap-2 border-b border-neutral-800 px-3 py-2 text-xs"
        >
          {[
            ["Add row", () => editor?.chain().focus().addRowAfter().run()],
            [
              "Add column",
              () => editor?.chain().focus().addColumnAfter().run(),
            ],
            ["Delete row", () => editor?.chain().focus().deleteRow().run()],
            [
              "Delete column",
              () => editor?.chain().focus().deleteColumn().run(),
            ],
            ["Delete table", () => editor?.chain().focus().deleteTable().run()],
          ].map(([label, run]) => (
            <button
              key={label as string}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={run as () => void}
              className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800"
            >
              {label as string}
            </button>
          ))}
        </div>
      )}
      {linkOpen && (
        <form
          noValidate
          aria-label="Edit note link"
          className="shrink-0 space-y-2 border-b border-neutral-800 p-3 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <label htmlFor="note-link" className="block text-neutral-400">
            Link address
          </label>
          <input
            id="note-link"
            ref={linkInput}
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setLinkError("");
            }}
            aria-invalid={!!linkError}
            aria-describedby={linkError ? "note-link-error" : undefined}
            className="w-full min-w-0 rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5"
            placeholder="https://example.com"
          />
          {linkError && (
            <p id="note-link-error" role="alert" className="text-rose-400">
              {linkError}
            </p>
          )}
          <div className="flex gap-2">
            <button className="rounded bg-blue-600 px-3 py-1">
              Apply link
            </button>
            <button
              type="button"
              onClick={() => {
                editor
                  ?.chain()
                  .focus()
                  .extendMarkRange("link")
                  .unsetLink()
                  .run();
                closeLink();
              }}
              className="rounded px-2 py-1 hover:bg-neutral-800"
            >
              Remove link
            </button>
            <button
              type="button"
              onClick={closeLink}
              className="rounded px-2 py-1 hover:bg-neutral-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {find && (
        <div
          role="search"
          aria-label="Find and replace notes"
          className="shrink-0 space-y-2 border-b border-neutral-800 p-2 text-xs"
        >
          <div className="flex items-center gap-1">
            <input
              ref={findInput}
              aria-label="Find in notes"
              placeholder="Find in notes…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(-1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  jump(e.shiftKey ? -1 : 1);
                }
              }}
              className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear note search"
                className="note-tool"
                onClick={() => {
                  setQuery("");
                  setActive(-1);
                  findInput.current?.focus();
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              aria-label="Previous note match"
              disabled={!matches.length}
              className="note-tool"
              onClick={() => jump(-1)}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next note match"
              disabled={!matches.length}
              className="note-tool"
              onClick={() => jump(1)}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Close note search"
              className="note-tool"
              onClick={() => {
                setFind(false);
                editor?.commands.focus();
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            aria-label="Replace in notes"
            value={replacement}
            placeholder="Replace with…"
            onChange={(e) => setReplacement(e.target.value)}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => {
                  setMatchCase(e.target.checked);
                  setActive(-1);
                }}
              />
              Match case
            </label>
            <button
              type="button"
              disabled={!matches.length}
              className="rounded border border-neutral-700 px-2 py-1 disabled:opacity-40"
              onClick={() => replace()}
            >
              Replace
            </button>
            <button
              type="button"
              disabled={!matches.length}
              className="rounded border border-neutral-700 px-2 py-1 disabled:opacity-40"
              onClick={() => replace(true)}
            >
              Replace all
            </button>
            <span role="status" className="text-neutral-500">
              {query
                ? matches.length
                  ? `${index + 1} / ${matches.length}`
                  : "No matches"
                : "Type to search"}
            </span>
          </div>
        </div>
      )}
      {outline && (
        <nav
          aria-label="Note outline"
          className="max-h-36 shrink-0 overflow-auto border-b border-neutral-800 p-2"
        >
          {state?.headings.length ? (
            state.headings.map((h) => (
              <button
                type="button"
                key={h.pos}
                className="block w-full truncate rounded py-1 text-left text-xs text-neutral-400 hover:bg-neutral-800"
                style={{ paddingLeft: 8 + (h.level - 1) * 10 }}
                onClick={() =>
                  editor
                    ?.chain()
                    .focus()
                    .setTextSelection(h.pos + 1)
                    .scrollIntoView()
                    .run()
                }
              >
                {h.text || "Untitled heading"}
              </button>
            ))
          ) : (
            <p className="p-2 text-xs text-neutral-500">
              Use a heading style to organize your notes.
            </p>
          )}
        </nav>
      )}
      <div
        onMouseDown={(event) => {
          if (
            !(event.target as HTMLElement).closest('[contenteditable="true"]')
          ) {
            event.preventDefault();
            editor?.commands.focus("end");
          }
        }}
        className="notes-rich min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
        style={
          {
            "--note-font-family": fontCssStack(appearance.font),
            "--note-font-size": `${appearance.size}px`,
            "--note-line-height": appearance.lineHeight,
          } as CSSProperties
        }
      >
        <EditorContent
          editor={editor}
          className="mx-auto min-h-full"
          style={{
            maxWidth:
              appearance.width === "full"
                ? "none"
                : appearance.width === "wide"
                  ? 1080
                  : 768,
          }}
        />
      </div>
      <footer className="flex min-h-10 shrink-0 items-center justify-between gap-2 border-t border-neutral-800 py-2 pl-28 pr-3 text-[10px] text-neutral-500">
        <span role="status">{notice}</span>
        <span className="shrink-0">
          {words} {words === 1 ? "word" : "words"} · {Math.ceil(words / 200)}{" "}
          min read
        </span>
      </footer>
    </section>
  );
}
