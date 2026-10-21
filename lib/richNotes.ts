import { Extension, type Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node } from '@tiptap/pm/model';
import { findNoteMatches } from './notesSearch';

export function richNoteMatches(doc: Node, query: string, matchCase = false) {
  const matches: { from: number; to: number }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    const text = node.textBetween(0, node.content.size, '\n', '\n');
    for (const match of findNoteMatches(text, query, matchCase)) matches.push({ from: pos + 1 + match.start, to: pos + 1 + match.end });
    return false;
  });
  return matches;
}
export const noteSearchKey = new PluginKey<{ query: string; matchCase: boolean; active: number }>('notes-search');
const NoteSearch = Extension.create({
  name: 'noteSearch',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: noteSearchKey,
      state: { init: () => ({ query: '', matchCase: false, active: -1 }), apply: (tr, previous) => tr.getMeta(noteSearchKey) ?? previous },
      props: { decorations(state) {
        const search = noteSearchKey.getState(state)!;
        return DecorationSet.create(state.doc, richNoteMatches(state.doc, search.query, search.matchCase).map((match, index) => Decoration.inline(match.from, match.to, { class: index === search.active ? 'note-match note-match-active' : 'note-match' })));
      } },
    })];
  },
});
export function richNotesExtensions() {
  return [StarterKit.configure({ underline: false, link: { openOnClick: false, defaultProtocol: 'https', protocols: ['https', 'http', 'mailto'] } }),
    Markdown, TaskList, TaskItem.configure({ nested: true }), TableKit, Image.configure({ allowBase64: true }),
    Placeholder.configure({ placeholder: 'Start writing your notes…' }), NoteSearch];
}
export function safeNoteLink(value: string): string | null {
  const input = value.trim();
  try { const url = new URL(/^[\w+.-]+:/.test(input) ? input : `https://${input}`); return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

/** Insert a note after the current top-level block, preserving selected writing. */
export function insertStickyNote(editor: Editor) {
  const { $to } = editor.state.selection;
  const position = $to.depth ? $to.after(1) : $to.pos;
  editor.commands.insertContentAt(position, [{type:'blockquote',content:[{type:'paragraph',content:[{type:'text',text:'Sticky note',marks:[{type:'bold'}]}]},{type:'paragraph'}]},{type:'paragraph'}]);
  const node=editor.state.doc.nodeAt(position);
  if(node)editor.commands.setTextSelection(position+node.nodeSize-2);
  editor.commands.focus();
}
