import { expect, test } from "bun:test";
import { blankTask, isTaskDate, readTasks, saveTask, taskDueState, taskLabels, tasksCsv } from "../lib/tasks.ts";

test("completing recurring work makes one successor with fresh checklist and a valid calendar date", () => {
  const draft = { ...blankTask(), title: "Monthly review", repeat: "monthly", due: "2028-01-31",
    checklist: [{ id: "check", title: "Read metrics", done: true }] };
  const [first] = saveTask([], draft);
  let tasks = saveTask([first], { ...first, status: "done" }, first.id);
  expect(tasks).toHaveLength(2);
  expect(tasks[1]).toMatchObject({ due: "2028-02-29", status: "todo", repeatsFrom: first.id,
    checklist: [{ id: "check", title: "Read metrics", done: false }] });
  tasks = saveTask(tasks, { ...tasks[0], status: "todo" }, first.id);
  tasks = saveTask(tasks, { ...tasks[0], status: "done" }, first.id);
  expect(tasks).toHaveLength(2);
  expect(readTasks(tasks)).toEqual(tasks.map(task => Object.fromEntries(Object.entries(task).filter(([, value]) => value !== undefined))));
});

test("invalid dates and repeating drafts without a date are rejected", () => {
  expect(isTaskDate("2027-02-29")).toBe(false);
  expect(isTaskDate("2028-02-29")).toBe(true);
  expect(() => saveTask([], { ...blankTask(), title: "Weekly", repeat: "weekly" })).toThrow("due date");
  const [task] = saveTask([], { ...blankTask(), title: "Deadline", due: "2028-02-29" });
  expect(taskDueState(task, "2028-02-29")).toBe("today");
  expect(taskDueState(task, "2028-03-01")).toBe("overdue");
  expect(taskDueState({ ...task, status: "done" }, "2028-03-01")).toBe("");
});

test("task labels deduplicate and CSV escapes formulas and quotes", () => {
  expect(taskLabels("Design, design, Briefing")).toEqual(["Design", "Briefing"]);
  const task = { ...blankTask(), title: "=2+2", description: 'Review "quote", then proceed' };
  expect(tasksCsv(saveTask([], task))).toContain('"\'=2+2"');
  expect(tasksCsv(saveTask([], task))).toContain('"Review ""quote"", then proceed"');
});
