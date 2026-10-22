export const PRESENTATION_SNIPPETS = [
  [
    "New slide",
    "Three dashes on a separate line start the next slide.",
    "\n\n---\n\n## Your heading\n\nYour message.\n",
  ],
  [
    "Headings and emphasis",
    "Use # for a title, ## for a heading, **bold**, and *italic*.",
    "\n## A clear heading\n\nA **bold idea** with *a little emphasis*.\n",
  ],
  [
    "Lists",
    "Use - for bullets or 1. for numbered steps.",
    "\n- First idea\n- Second idea\n\n1. First step\n2. Next step\n",
  ],
  [
    "Reveal in steps",
    "Content after this marker appears when you advance.",
    "\n\n<!-- step -->\n\nReveal your next point.\n",
  ],
  [
    "Speaker notes",
    "Private reminders stay out of the audience view, HTML, and PDF.",
    "\n\n<!-- notes: Pause here and ask a question. -->\n",
  ],
  [
    "Per-slide design",
    "Override the theme and layout for just this slide. Theme names: midnight, paper, slate, ocean, dusk, studio. Layouts: standard, center, split.",
    "\n<!-- theme: paper -->\n<!-- layout: center -->\n",
  ],
  [
    "Code",
    "Use a fenced block with a language, such as js, python, or sql.",
    '\n```js\nconst idea = "Make it clear";\nconsole.log(idea);\n```\n',
  ],
  [
    "Diagram",
    "Mermaid diagrams turn a fenced block into a visual.",
    "\n```mermaid\nflowchart LR\n  Idea --> Build --> Share\n```\n",
  ],
  [
    "Equation",
    "Put display math between two $$ lines.",
    "\n$$\nE = mc^2\n$$\n",
  ],
  [
    "Table",
    "Use pipes for columns and dashes under the header.",
    "\n| Step | Outcome |\n| --- | --- |\n| Explore | An idea |\n| Build | A result |\n",
  ],
  [
    "Quote and link",
    "Use > for a quote, and [label](URL) for a link.",
    "\n> Make the complex feel simple.\n\n[Learn more](https://example.com)\n",
  ],
  [
    "Image",
    "Upload with Image to keep a local copy, or use Markdown with a URL.",
    "\n![Describe the image](https://example.com/image.png)\n",
  ],
  [
    "Reveal individual bullets",
    "Put {reveal} after an item to reveal it before changing slides.",
    "\n- First point\n- Second point {reveal}\n- Third point {reveal}\n",
  ],
  [
    "Split image right",
    "An image title of right makes a content-and-image slide.",
    '\n![Describe the image](image.png "right")\n',
  ],
  [
    "Split image left",
    "Use left to place the image beside the text.",
    '\n![Describe the image](image.png "left")\n',
  ],
  [
    "Background image",
    "Use bg and an opacity between 0 and 1. Upload images locally with Image.",
    '\n![Describe the background](image.png "bg opacity:0.25")\n',
  ],
  [
    "Inline equation",
    "Use $...$ or \\(...\\) inside a sentence.",
    "\nThe amortized cost is $O(1)$ per operation.\n",
  ],
  [
    "Video",
    "Use an HTML video element. External media needs network access and is not interactive in PDF.",
    '\n<video src="https://example.com/demo.mp4" controls muted></video>\n',
  ],
  [
    "Embed",
    "Embed an HTTPS page in an isolated frame.",
    '\n<iframe src="https://example.com" title="Embedded page"></iframe>\n',
  ],
  [
    "Keycaps and marks",
    "Add a keycap or emphasize text with a marker.",
    "\nPress <kbd>Ctrl</kbd> + <kbd>K</kbd> to insert a <mark>clear idea</mark>.\n",
  ],
] as const;
