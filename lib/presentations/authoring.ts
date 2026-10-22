import { parseSlides } from "./model";
function parts(source: string) {
  return parseSlides(source).map((slide) =>
    source.slice(slide.start, slide.end).trim(),
  );
}
export function moveSlide(source: string, from: number, to: number) {
  const chunks = parts(source);
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= chunks.length ||
    to >= chunks.length ||
    from === to
  )
    return source;
  const [item] = chunks.splice(from, 1);
  chunks.splice(to, 0, item);
  return chunks.join("\n\n---\n\n") + "\n";
}
export function duplicateSlide(source: string, index: number) {
  const chunks = parts(source);
  if (!Number.isInteger(index) || index < 0 || index >= chunks.length)
    return source;
  chunks.splice(index + 1, 0, chunks[index]);
  return chunks.join("\n\n---\n\n") + "\n";
}
export function writeSpeakerNotes(
  source: string,
  index: number,
  notes: string,
) {
  const slide = parseSlides(source)[index];
  if (!slide) return source;
  const encoded = JSON.stringify(notes).replace(/>/g, "\\u003e");
  const replacement =
    slide.source +
    (notes ? `\n\n<!-- notes-json: ${encoded} -->` : "") +
    "\n\n";
  return source.slice(0, slide.start) + replacement + source.slice(slide.end);
}
export const STORY_STARTERS = [
  {
    id: "brief",
    title: "Project update",
    description: "Progress, decisions, and what happens next.",
    source:
      "# Project update\n\nThe outcome that matters.\n\n---\n\n## Progress\n\n- What shipped\n- What we learned\n\n---\n\n## Decisions needed\n\n- The decision\n- Your recommendation {reveal}\n\n---\n\n## Next steps\n\n| Action | Owner | When |\n| --- | --- | --- |\n| Your next step | Name | Date |\n",
  },
  {
    id: "lesson",
    title: "Teach a concept",
    description: "Explain, demonstrate, then check understanding.",
    source:
      "# One idea worth learning\n\nWhat you will understand by the end.\n\n---\n\n## Start with a question\n\nWhat do you already know about this?\n\n---\n\n## How it works\n\n1. The starting point\n2. The key insight {reveal}\n3. The result {reveal}\n\n---\n\n## Try it yourself\n\nA small challenge to apply the idea.\n\n---\n\n## What did you learn?\n\n- One takeaway\n- One question to explore next\n",
  },
  {
    id: "pitch",
    title: "Pitch an idea",
    description: "A clear problem, proposal, evidence, and ask.",
    source:
      "# A better way forward\n\nYour idea in one sentence.\n\n---\n\n## The problem\n\nWho experiences it, and why it matters.\n\n---\n\n## The proposal\n\nA clear explanation of your approach.\n\n---\n\n## Why it works\n\n- Evidence\n- Expected impact {reveal}\n\n---\n\n## The ask\n\nThe decision or support you need.\n",
  },
  {
    id: "demo",
    title: "Product demo",
    description: "Set the scene, show the workflow, and land the value.",
    source:
      "# Meet your next workflow\n\nOne benefit, clearly stated.\n\n---\n\n## Before\n\nThe friction your audience knows.\n\n---\n\n## See it in action\n\n1. Start here\n2. Make the key action {reveal}\n3. See the result {reveal}\n\n---\n\n## The difference\n\n| Before | After |\n| --- | --- |\n| Old process | New outcome |\n\n---\n\n## Try it\n\nYour next step.\n",
  },
  {
    id: "workshop",
    title: "Interactive workshop",
    description: "Alternate short explanations with audience activities.",
    source:
      "# Build an idea together\n\nWhat we will make today.\n\n---\n\n## The challenge\n\nA problem worth solving together.\n\n---\n\n## Think on your own\n\nWrite down three possible approaches.\n\n---\n\n## Compare and discuss\n\n- What is similar?\n- What surprised you? {reveal}\n\n---\n\n## Share a direction\n\nExplain your choice in one sentence.\n\n---\n\n## Take it forward\n\nOne action you will try next.\n",
  },
  {
    id: "decision",
    title: "Compare options",
    description: "Make tradeoffs visible and finish with a decision.",
    source:
      "# A decision worth making\n\nThe choice in front of us.\n\n---\n\n## What matters\n\n- The goal\n- Constraints\n- Success criteria\n\n---\n\n## The options\n\n| Criteria | Option A | Option B |\n| --- | --- | --- |\n| Impact | Describe | Describe |\n| Effort | Describe | Describe |\n\n---\n\n## Recommendation\n\nThe option and the reasoning.\n\n---\n\n## Commit to the next step\n\nWho does what, by when.\n",
  },
] as const;
