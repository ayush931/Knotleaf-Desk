import { closeHistory } from "@tiptap/pm/history";
import { DOMSerializer } from "@tiptap/pm/model";
import {
  TextStyle,
  FontFamily,
  FontSize,
  Color,
} from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import {
  Details,
  DetailsSummary,
  DetailsContent,
} from "@tiptap/extension-details";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";
import { MarkdownManager } from "@tiptap/markdown";
import { fontCssStack } from "@/draw/fonts";
import { normalizeNoteColor, normalizeNoteFont } from "./notesDocument";
import {
  Extension,
  getSchema,
  type JSONContent,
  type Editor,
} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node } from "@tiptap/pm/model";
import { findNoteMatches } from "./notesSearch";

export function richNoteMatches(doc: Node, query: string, matchCase = false) {
  const matches: { from: number; to: number }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    const text = node.textBetween(0, node.content.size, "\n", "\n");
    for (const match of findNoteMatches(text, query, matchCase))
      matches.push({ from: pos + 1 + match.start, to: pos + 1 + match.end });
    return false;
  });
  return matches;
}
export const noteSearchKey = new PluginKey<{
  query: string;
  matchCase: boolean;
  active: number;
}>("notes-search");
const NoteSearch = Extension.create({
  name: "noteSearch",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: noteSearchKey,
        state: {
          init: () => ({ query: "", matchCase: false, active: -1 }),
          apply: (tr, previous) => tr.getMeta(noteSearchKey) ?? previous,
        },
        props: {
          decorations(state) {
            const search = noteSearchKey.getState(state)!;
            return DecorationSet.create(
              state.doc,
              richNoteMatches(state.doc, search.query, search.matchCase).map(
                (match, index) =>
                  Decoration.inline(match.from, match.to, {
                    class:
                      index === search.active
                        ? "note-match note-match-active"
                        : "note-match",
                  }),
              ),
            );
          },
        },
      }),
    ];
  },
});
const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const NoteTextStyle = TextStyle.extend({
  renderMarkdown(node, h) {
    const attrs = node.attrs || {},
      font = normalizeNoteFont(attrs.fontFamily),
      color = normalizeNoteColor(attrs.color),
      size = parseFloat(attrs.fontSize || "");
    const styles = [
      font ? `font-family:${fontCssStack(font)}` : "",
      color ? `color:${color}` : "",
      Number.isFinite(size) && size >= 8 && size <= 128
        ? `font-size:${size}px`
        : "",
    ]
      .filter(Boolean)
      .join(";");
    return styles
      ? `<span${font ? ` data-note-font="${font}"` : ""} style="${esc(styles)}">${h.renderChildren(node)}</span>`
      : h.renderChildren(node);
  },
});
const NoteFont = FontFamily.extend({
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (e) =>
              normalizeNoteFont(
                e.getAttribute("data-note-font") || e.style.fontFamily,
              ),
            renderHTML: (attrs) => {
              const font = normalizeNoteFont(attrs.fontFamily);
              return font
                ? {
                    "data-note-font": font,
                    style: `font-family:${fontCssStack(font)}`,
                  }
                : {};
            },
          },
        },
      },
    ];
  },
});
const NoteSize = FontSize.extend({
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (e) => {
              const size = parseFloat(e.style.fontSize);
              return /^\d+(?:\.\d+)?px$/.test(e.style.fontSize) &&
                size >= 8 &&
                size <= 128
                ? `${size}px`
                : null;
            },
            renderHTML: (attrs) => {
              const size = parseFloat(attrs.fontSize);
              return Number.isFinite(size) && size >= 8 && size <= 128
                ? { style: `font-size:${size}px` }
                : {};
            },
          },
        },
      },
    ];
  },
});
const NoteColor = Color.extend({
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          color: {
            default: null,
            parseHTML: (e) => normalizeNoteColor(e.style.color),
            renderHTML: (attrs) => {
              const color = normalizeNoteColor(attrs.color);
              return color ? { style: `color:${color}` } : {};
            },
          },
        },
      },
    ];
  },
});
const NoteHighlight = Highlight.extend({
  renderMarkdown(node, h) {
    const color = normalizeNoteColor(node.attrs?.color) || "#665329";
    return `<mark data-color="${color}" style="background-color:${color};color:inherit">${h.renderChildren(node)}</mark>`;
  },
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (e) =>
          normalizeNoteColor(
            e.getAttribute("data-color") || e.style.backgroundColor,
          ),
        renderHTML: (attrs) => {
          const color = normalizeNoteColor(attrs.color);
          return color
            ? {
                "data-color": color,
                style: `background-color:${color};color:inherit`,
              }
            : {};
        },
      },
    };
  },
}).configure({ multicolor: true });
let noteSchema: ReturnType<typeof getSchema> | undefined;
function nodeHTML(node: JSONContent): string {
  noteSchema ||= getSchema(richNotesExtensions());
  const dom = DOMSerializer.fromSchema(noteSchema).serializeNode(
    noteSchema.nodeFromJSON(node),
    { document },
  );
  const host = document.createElement("div");
  host.append(dom);
  return host.innerHTML;
}
const NoteParagraph = Paragraph.extend({
  renderMarkdown(node, h, ctx) {
    return hasAdvancedFormatting(node)
      ? nodeHTML(node)
      : Paragraph.config.renderMarkdown!.call(this, node, h, ctx);
  },
});
const NoteHeading = Heading.extend({
  renderMarkdown(node, h, ctx) {
    return hasAdvancedFormatting(node)
      ? nodeHTML(node)
      : Heading.config.renderMarkdown!.call(this, node, h, ctx);
  },
});
let markdownManager: MarkdownManager | undefined;
/** Render only schema-owned HTML; imported scripts/events and arbitrary CSS never survive. */
export function notesToSafeHtml(value: string, options: { deferImages?: boolean } = {}): string {
  markdownManager ||= new MarkdownManager({
    extensions: richNotesExtensions(),
  });
  const json = markdownManager.parse(value);
  const imageSources: (string | null)[] = [];
  if(options.deferImages){
    const defer=(node:JSONContent)=>{if(node.type==='image'){imageSources.push(typeof node.attrs?.src==='string'?node.attrs.src:null);node.attrs={...node.attrs,src:null};}node.content?.forEach(defer);};
    defer(json);
  }
  noteSchema ||= getSchema(richNotesExtensions());
  const fragment = DOMSerializer.fromSchema(noteSchema).serializeFragment(
    noteSchema.nodeFromJSON(json).content,
    { document },
  );
  const host = document.createElement("div");
  host.append(fragment);
  if(options.deferImages)host.querySelectorAll('img').forEach((image,index)=>{const src=imageSources[index];if(src)image.setAttribute('data-markdown-image-src',src);});
  return host.innerHTML;
}
export function richNotesExtensions() {
  return [
    StarterKit.configure({
      paragraph: false,
      heading: false,
      link: {
        openOnClick: false,
        defaultProtocol: "https",
        protocols: ["https", "http", "mailto"],
      },
    }),
    NoteParagraph,
    NoteHeading,
    NoteTextStyle,
    NoteFont,
    NoteSize,
    NoteColor,
    NoteHighlight,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Details.configure({
      persist: true,
      renderToggleButton: ({ element, isOpen }) => {
        element.setAttribute(
          "aria-label",
          isOpen ? "Collapse details content" : "Expand details content",
        );
        element.setAttribute("aria-expanded", String(isOpen));
      },
    }),
    DetailsSummary,
    DetailsContent,
    Subscript,
    Superscript,
    Markdown,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit,
    Image.configure({ allowBase64: true }),
    Placeholder.configure({
      placeholder: "Start writing, or type / for blocks…",
    }),
    NoteSearch,
  ];
}
export function safeNoteLink(value: string): string | null {
  const input = value.trim();
  try {
    const url = new URL(/^[\w+.-]+:/.test(input) ? input : `https://${input}`);
    return ["https:", "http:", "mailto:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function noteBlockInsertion(editor: Editor) {
  const { $from, $to, empty } = editor.state.selection;
  if (
    $from.depth &&
    empty &&
    $from.node(1).type.name === "paragraph" &&
    $from.node(1).content.size === 0
  )
    return { from: $from.before(1), to: $from.after(1) };
  const position = $to.depth ? $to.after(1) : $to.pos;
  return { from: position, to: position };
}
/** Insert a note after the current top-level block, preserving selected writing. */
export function insertStickyNote(editor: Editor) {
  editor.view.dispatch(closeHistory(editor.state.tr));
  const range = noteBlockInsertion(editor),
    position = range.from;
  editor.commands.insertContentAt(range, [
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Sticky note", marks: [{ type: "bold" }] },
          ],
        },
        { type: "paragraph" },
      ],
    },
    { type: "paragraph" },
  ]);
  const node = editor.state.doc.nodeAt(position);
  if (node) editor.commands.setTextSelection(position + node.nodeSize - 2);
  editor.commands.focus();
  editor.view.dispatch(closeHistory(editor.state.tr));
}

function hasAdvancedFormatting(node: JSONContent): boolean {
  return (
    !!node.attrs?.textAlign ||
    !!node.marks?.some((mark) =>
      [
        "textStyle",
        "highlight",
        "underline",
        "subscript",
        "superscript",
      ].includes(mark.type),
    ) ||
    !!node.content?.some(hasAdvancedFormatting)
  );
}
/** Styled top-level blocks use safe HTML so Markdown never strips their appearance. */
export function serializeRichNotes(editor: Editor): string {
  const blocks = editor.getJSON().content || [];
  if (!blocks.some(hasAdvancedFormatting)) return editor.getMarkdown();
  markdownManager ||= new MarkdownManager({
    extensions: richNotesExtensions(),
  });
  return blocks
    .map((node) =>
      hasAdvancedFormatting(node)
        ? nodeHTML(node)
        : markdownManager!.serialize({ type: "doc", content: [node] }),
    )
    .join("\n\n");
}

export function insertToggleSection(editor: Editor) {
  editor.view.dispatch(closeHistory(editor.state.tr));
  const range = noteBlockInsertion(editor),
    position = range.from;
  editor.commands.insertContentAt(range, [
    {
      type: "details",
      attrs: { open: true },
      content: [
        {
          type: "detailsSummary",
          content: [{ type: "text", text: "Toggle section" }],
        },
        { type: "detailsContent", content: [{ type: "paragraph" }] },
      ],
    },
    { type: "paragraph" },
  ]);
  editor
    .chain()
    .focus()
    .setTextSelection({ from: position + 2, to: position + 16 })
    .scrollIntoView()
    .run();
  editor.view.dispatch(closeHistory(editor.state.tr));
}
export function insertNoteTemplate(editor: Editor, content: string) {
  editor.view.dispatch(closeHistory(editor.state.tr));
  const range = noteBlockInsertion(editor),
    position = range.from;
  editor
    .chain()
    .focus()
    .insertContentAt(range, content, { contentType: "markdown" })
    .setTextSelection(position + 1)
    .scrollIntoView()
    .run();
  editor.view.dispatch(closeHistory(editor.state.tr));
}
export function insertInternalNoteLink(
  editor: Editor,
  id: string,
  title: string,
) {
  const href = `#note=${encodeURIComponent(id)}`;
  if (editor.state.selection.empty) {
    const marks = (
      editor.state.storedMarks || editor.state.selection.$from.marks()
    )
      .filter((mark) => mark.type.name !== "link")
      .map((mark) => mark.toJSON());
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "text",
          text: title,
          marks: [...marks, { type: "link", attrs: { href } }],
        },
        { type: "text", text: " ", marks },
      ])
      .unsetLink()
      .run();
  } else editor.chain().focus().setLink({ href }).run();
}
export function duplicateNoteBlock(editor: Editor) {
  const { $from } = editor.state.selection;
  if (!$from.depth) return false;
  const node = $from.node(1),
    position = $from.after(1);
  editor.view.dispatch(closeHistory(editor.state.tr));
  const result = editor
    .chain()
    .focus()
    .insertContentAt(position, node.toJSON())
    .scrollIntoView()
    .run();
  editor.view.dispatch(closeHistory(editor.state.tr));
  return result;
}
export function moveNoteBlock(editor: Editor, direction: -1 | 1) {
  const { $from } = editor.state.selection,
    doc = editor.state.doc;
  if (!$from.depth) return false;
  const index = $from.index(0),
    other = index + direction;
  if (other < 0 || other >= doc.childCount) return false;
  editor.view.dispatch(closeHistory(editor.state.tr));
  const start = $from.before(1),
    node = doc.child(index),
    target =
      direction < 0
        ? start - doc.child(other).nodeSize
        : start + doc.child(other).nodeSize;
  const tr = editor.state.tr
    .delete(start, start + node.nodeSize)
    .insert(target, node);
  tr.setSelection(TextSelection.near(tr.doc.resolve(target + 1)));
  editor.view.dispatch(tr);
  editor.chain().focus().scrollIntoView().run();
  editor.view.dispatch(closeHistory(editor.state.tr));
  return true;
}

/** Apply only the changed document range, retaining the caret and local undo mappings. */
export function applyRemoteNotes(editor: Editor, value: string) {
  const json = editor.markdown!.parse(value),
    current = editor.state.doc,
    next = editor.schema.nodeFromJSON(json);
  const start = current.content.findDiffStart(next.content);
  if (start === null) return;
  const end = current.content.findDiffEnd(next.content) || {
    a: current.content.size,
    b: next.content.size,
  };
  let oldEnd = end.a,
    newEnd = end.b;
  const overlap = start - Math.min(oldEnd, newEnd);
  if (overlap > 0) {
    oldEnd += overlap;
    newEnd += overlap;
  }
  const tr = editor.state.tr
    .replace(start, oldEnd, next.slice(start, newEnd))
    .setMeta("addToHistory", false)
    .setMeta("preventUpdate", true);
  editor.view.dispatch(tr);
}
