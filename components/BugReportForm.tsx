"use client";

import { useRef, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import {
  bugReportUrl,
  formatBugReport,
  type BugReportDraft,
  type BugReportEnvironment,
} from "@/lib/bugReport";

const emptyDraft: BugReportDraft = {
  summary: "",
  steps: "",
  expected: "",
  actual: "",
};

export function BugReportForm() {
  const [draft, setDraft] = useState<BugReportDraft>(emptyDraft);
  const [includeEnvironment, setIncludeEnvironment] = useState(true);
  const [notice, setNotice] = useState("");
  const preview = useRef<HTMLTextAreaElement>(null);
  const disclosure = useRef<HTMLDetailsElement>(null);
  const environment: BugReportEnvironment | undefined =
    includeEnvironment && typeof window !== "undefined"
      ? {
          browser: navigator.userAgent,
          viewport: `${window.innerWidth} × ${window.innerHeight}`,
          mode: window.matchMedia("(display-mode: standalone)").matches
            ? "Installed app"
            : ["localhost", "127.0.0.1", "[::1]"].includes(
                  window.location.hostname,
                )
              ? "Local website"
              : "Hosted website",
        }
      : undefined;
  const report = formatBugReport(draft, environment);
  const issueUrl = bugReportUrl(draft, environment);
  const needsPaste = !new URL(issueUrl).searchParams.has("body");
  const ready = !!draft.summary.trim() && !!draft.steps.trim();
  const field =
    "mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200";
  const action =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-40";
  const update = (key: keyof BugReportDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice("");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setNotice("Report copied. Paste it into an issue or support message.");
    } catch {
      if (disclosure.current) disclosure.current.open = true;
      preview.current?.focus();
      preview.current?.select();
      setNotice(
        "Automatic copy is unavailable. The report is selected below; copy it manually.",
      );
    }
  };
  return (
    <section aria-label="Bug report" className="space-y-4">
      <p className="text-xs leading-relaxed text-neutral-400">
        Describe what went wrong. Review your report on GitHub before
        submitting, or copy it to share elsewhere. GitHub reports are public and
        require a GitHub account.
      </p>
      <label className="block text-xs text-neutral-300">
        Summary <span className="text-neutral-500">(required)</span>
        <input
          aria-label="Bug summary"
          required
          maxLength={120}
          value={draft.summary}
          onChange={(event) => update("summary", event.target.value)}
          placeholder="For example: a template appears outside the canvas"
          className={`${field} resize-none`}
        />
      </label>
      <label className="block text-xs text-neutral-300">
        Steps to reproduce <span className="text-neutral-500">(required)</span>
        <textarea
          aria-label="Steps to reproduce"
          required
          maxLength={2000}
          rows={3}
          value={draft.steps}
          onChange={(event) => update("steps", event.target.value)}
          placeholder={"1. Open a board\n2. …"}
          className={`${field} resize-none`}
        />
      </label>
      <label className="block text-xs text-neutral-300">
        Expected behavior
        <textarea
          aria-label="Expected behavior"
          maxLength={1000}
          rows={2}
          value={draft.expected}
          onChange={(event) => update("expected", event.target.value)}
          placeholder="What should happen?"
          className={`${field} resize-none`}
        />
      </label>
      <label className="block text-xs text-neutral-300">
        Actual behavior
        <textarea
          aria-label="Actual behavior"
          maxLength={1000}
          rows={2}
          value={draft.actual}
          onChange={(event) => update("actual", event.target.value)}
          placeholder="What happened? Include any error message."
          className={`${field} resize-none`}
        />
      </label>
      <div>
        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input
            type="checkbox"
            checked={includeEnvironment}
            onChange={(event) => {
              setIncludeEnvironment(event.target.checked);
              setNotice("");
            }}
            className="accent-blue-500"
          />
          Include browser, screen size and app mode
        </label>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
          Canvas content, notes, board IDs and room links are never collected.
          Review anything private you type before sharing.
        </p>
      </div>
      <details ref={disclosure}>
        <summary className="cursor-pointer text-xs text-neutral-400">
          Preview report
        </summary>
        <textarea
          ref={preview}
          aria-label="Bug report preview"
          readOnly
          value={report}
          rows={10}
          className={`${field} resize-none font-mono text-xs`}
        />
      </details>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() => void copy()}
          className={action}
        >
          <Copy className="h-3.5 w-3.5" />
          Copy report
        </button>
        {ready ? (
          <a
            href={issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${action} border-blue-500/40 text-blue-300`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Review on GitHub
          </a>
        ) : (
          <button type="button" disabled className={action}>
            <ExternalLink className="h-3.5 w-3.5" />
            Review on GitHub
          </button>
        )}
      </div>
      {ready && needsPaste && (
        <p className="text-xs text-amber-300">
          This report is too long to prefill. Copy it, then paste it into the
          GitHub issue.
        </p>
      )}
      <p role="status" className="text-xs text-neutral-400">
        {notice ||
          (!ready
            ? "Add a summary and reproduction steps to prepare your report."
            : "Your report is ready to review. Nothing is submitted automatically.")}
      </p>
    </section>
  );
}
