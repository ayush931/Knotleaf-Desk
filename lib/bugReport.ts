export interface BugReportDraft {
  summary: string;
  steps: string;
  expected: string;
  actual: string;
}

export interface BugReportEnvironment {
  browser: string;
  viewport: string;
  mode: string;
}

export function formatBugReport(
  draft: BugReportDraft,
  environment?: BugReportEnvironment,
): string {
  const sections = [
    `# ${draft.summary.trim() || "Bug report"}`,
    `## Steps to reproduce\n${draft.steps.trim() || "(Please describe the steps.)"}`,
    `## Expected behavior\n${draft.expected.trim() || "(Not provided)"}`,
    `## Actual behavior\n${draft.actual.trim() || "(Not provided)"}`,
  ];
  if (environment)
    sections.push(
      `## Environment\n- Browser: ${environment.browser}\n- Viewport: ${environment.viewport}\n- App mode: ${environment.mode}`,
    );
  return sections.join("\n\n");
}

export function bugReportUrl(
  draft: BugReportDraft,
  environment?: BugReportEnvironment,
): string {
  const url = new URL("https://github.com/ayush931/Knotleaf-Desk/issues/new");
  url.searchParams.set("title", draft.summary.trim().slice(0, 120));
  url.searchParams.set("body", formatBugReport(draft, environment));
  // Keep long or heavily encoded reports within browsers’ practical URL limits.
  // The form explains that these reports must be copied and pasted instead.
  if (url.toString().length > 7500) url.searchParams.delete("body");
  return url.toString();
}
