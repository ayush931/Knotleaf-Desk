#!/usr/bin/env node
import fs from "node:fs/promises";
import { lintPresentation } from "../lib/presentations/lint.mjs";
const args = process.argv.slice(2),
  json = args.includes("--json");
const thresholdIndex = args.indexOf("--max-warnings");
const threshold = thresholdIndex < 0 ? 0 : Number(args[thresholdIndex + 1]);
const files = args.filter(
  (arg, index) =>
    !arg.startsWith("--") &&
    (thresholdIndex < 0 || index !== thresholdIndex + 1),
);
if (!files.length) {
  console.log(
    "Usage: node scripts/lint-presentations.mjs slides.md [more.md] [--json] [--max-warnings N]\nUse - to read standard input.",
  );
  process.exitCode = 2;
} else {
  const reports = [];
  for (const file of files) {
    try {
      const source =
        file === "-"
          ? await new Promise((resolve, reject) => {
              let text = "";
              process.stdin.setEncoding("utf8");
              process.stdin.on("data", (chunk) => (text += chunk));
              process.stdin.on("end", () => resolve(text));
              process.stdin.on("error", reject);
            })
          : await fs.readFile(file, "utf8");
      reports.push({ file, issues: lintPresentation(source) });
    } catch (error) {
      reports.push({
        file,
        issues: [
          {
            line: 1,
            slide: 1,
            severity: "error",
            rule: "read-file",
            message: error.message,
          },
        ],
      });
    }
  }
  if (json) console.log(JSON.stringify(reports, null, 2));
  else
    for (const report of reports) {
      if (!report.issues.length) console.log(`${report.file}: OK`);
      for (const issue of report.issues)
        console.log(
          `${report.file}:${issue.line} slide ${issue.slide} ${issue.severity} [${issue.rule}] ${issue.message}`,
        );
    }
  const issues = reports.flatMap((report) => report.issues);
  if (
    issues.some((issue) => issue.severity === "error") ||
    (threshold >= 0 &&
      issues.filter((issue) => issue.severity === "warning").length > threshold)
  )
    process.exitCode = 1;
}
