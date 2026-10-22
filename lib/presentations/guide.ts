import { PRESENTATION_SNIPPETS } from "./snippets";
export const GUIDE_GROUPS = [
  "All examples",
  "Basics",
  "Media",
  "Code & math",
  "Design",
  "Presenting",
] as const;
export type GuideGroup = (typeof GUIDE_GROUPS)[number];
const groups: Record<string, GuideGroup> = {
  "Reveal in steps": "Presenting",
  "Reveal individual bullets": "Presenting",
  "Speaker notes": "Presenting",
  "Per-slide design": "Design",
  "Background image": "Design",
  "Split image right": "Design",
  "Split image left": "Design",
  Image: "Media",
  Video: "Media",
  Embed: "Media",
  Code: "Code & math",
  Diagram: "Code & math",
  Equation: "Code & math",
  "Inline equation": "Code & math",
};
export const GUIDE_EXAMPLES = PRESENTATION_SNIPPETS.map(
  ([title, description, source]) => ({
    title,
    description,
    source,
    group: groups[title] || "Basics",
    media: /!\[|<video|<iframe/.test(source),
  }),
);
export const EDITOR_SHORTCUTS = [
  ["Ctrl / ⌘ + K", "Open Insert commands"],
  ["Ctrl / ⌘ + /", "Open or close this guide"],
  ["Ctrl / ⌘ + Enter", "Start presenting"],
  ["Ctrl / ⌘ + O", "Open your presentation library"],
  ["Ctrl / ⌘ + D", "Add a new slide"],
  ["Alt + ← / →", "Go to the previous or next slide"],
  ["Ctrl / ⌘ + Shift + L", "Choose a theme"],
  ["Ctrl / ⌘ + G", "Toggle the slide grid"],
  [
    "Ctrl / ⌘ + B / I / E",
    "Bold, italic, or inline code in the Markdown editor",
  ],
  ["Ctrl / ⌘ + S", "Download Markdown source (HTML source for HTML documents)"],
  ["Ctrl / ⌘ + Shift + S", "Export PDF"],
] as const;
export const PRESENTER_SHORTCUTS = [
  ["→ / Space / Page Down", "Next reveal, then next slide"],
  ["← / Page Up", "Previous reveal or slide"],
  ["Home / End", "First or last slide"],
  ["F", "Toggle fullscreen"],
  ["O", "Open slide overview"],
  ["L", "Toggle laser pointer"],
  ["D", "Toggle the drawing pen"],
  ["C", "Open a blank drawing surface"],
  ["B", "Black out the screen"],
  ["E", "Toggle eraser while drawing"],
  ["[ / ]", "Decrease or increase pen width"],
  ["1–5", "Change pen color while drawing"],
  ["Ctrl / ⌘ + Z", "Undo a stroke while drawing"],
  ["X", "Clear strokes while drawing"],
  ["H / ?", "Show presenter controls"],
  ["Escape", "Close the active tool or overlay, then exit"],
] as const;
export const GUIDE_FAQ = [
  [
    "My content is too large for a slide",
    "Keep one main idea per slide. Split long lists with a new slide, reduce Size in the toolbar, or use incremental reveals. Slide checks can point out dense content and long headings.",
  ],
  [
    "The preview shows code instead of a diagram",
    "Put Mermaid inside a fenced code block starting with ```mermaid. Close it with another line of three backticks. JavaScript, Python, SQL, and other code fences show highlighted source instead.",
  ],
  [
    "An image is missing from PDF",
    "Use Image in the toolbar to upload a local copy. A remote image may block export through its cross-origin policy. Local images are embedded; available storage depends on your browser.",
  ],
  [
    "Where are my presentations saved?",
    "They are saved in this browser on this device, separately from canvas project backups. They are not synchronized through collaboration rooms. Export a Presentation backup to move an editable deck to another device.",
  ],
  [
    "The app says my presentation was not saved",
    "Keep the tab open and export a Presentation backup before leaving. Free browser storage and retry. Clearing site data removes locally saved presentations and assets.",
  ],
  [
    "Can the audience see my speaker notes?",
    "Speaker notes stay out of the presenter surface and audience HTML/PDF. Markdown source and Presentation backups include them, so share those only when you intend to share your editable writing.",
  ],
  [
    "Which format should I share?",
    "Use PDF for a static deck, or Standalone HTML for reveals and presenter tools. Uploaded images and presentation fonts are embedded in HTML; external media still needs internet. Use Presentation backup for an editable copy.",
  ],
] as const;
