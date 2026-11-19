export const TASK_STATUSES = ["todo", "doing", "review", "done"] as const;
export const TASK_PRIORITIES = ["urgent", "high", "normal", "low"] as const;
export const TASK_REPEATS = ["none", "daily", "weekly", "monthly"] as const;
export type TaskStatus = typeof TASK_STATUSES[number];
export type TaskPriority = typeof TASK_PRIORITIES[number];
export type TaskRepeat = typeof TASK_REPEATS[number];
export const taskStatusLabel: Record<TaskStatus, string> = {
  todo: "To do", doing: "In progress", review: "In review", done: "Done",
};
export type ChecklistItem = { id: string; title: string; done: boolean };
export type TaskDraft = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due: string;
  owner: string;
  labels: string[];
  checklist: ChecklistItem[];
  repeat: TaskRepeat;
};
export type Task = TaskDraft & {
  id: string;
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
  repeatsFrom?: string;
};
export const TASK_LIMIT = 1000;
export const CHECKLIST_LIMIT = 30;
export const LABEL_LIMIT = 8;

export function blankTask(status: TaskStatus = "todo"): TaskDraft {
  return { title: "", description: "", status, priority: "normal", due: "", owner: "", labels: [], checklist: [], repeat: "none" };
}

export function localTaskDate(date = new Date()): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index ? 2 : 4, "0")).join("-");
}

export function isTaskDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function nextDate(value: string, repeat: Exclude<TaskRepeat, "none">) {
  const date = new Date(value + "T12:00:00Z");
  if (repeat === "monthly") {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    const end = new Date(date);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(day, end.getUTCDate()));
  } else date.setUTCDate(date.getUTCDate() + (repeat === "weekly" ? 7 : 1));
  const next = date.toISOString().slice(0, 10);
  return isTaskDate(next) ? next : "";
}

export function taskLabels(value: string) {
  const unique = new Map<string, string>();
  for (const item of value.split(",")) {
    const label = item.trim().slice(0, 32);
    if (label && !unique.has(label.toLowerCase())) unique.set(label.toLowerCase(), label);
  }
  return [...unique.values()].slice(0, LABEL_LIMIT);
}

function isShortText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

export function validateTaskDraft(value: TaskDraft) {
  if (!value.title.trim()) return "Enter a task title.";
  if (value.due && !isTaskDate(value.due)) return "Enter a valid due date.";
  if (value.repeat !== "none" && !value.due) return "Add a due date for this repeating task.";
  return "";
}

function normalizeTask(value: unknown): Task {
  const task = value as Task;
  if (
    !task || !isShortText(task.id, 80) || !task.id ||
    !isShortText(task.title, 140) ||
    !isShortText(task.description, 5000) || !isShortText(task.owner, 80) ||
    !TASK_STATUSES.includes(task.status) || !TASK_PRIORITIES.includes(task.priority) ||
    !TASK_REPEATS.includes(task.repeat) || typeof task.due !== "string" ||
    !Array.isArray(task.labels) || task.labels.length > LABEL_LIMIT || !task.labels.every(label => isShortText(label, 32)) ||
    !Array.isArray(task.checklist) || task.checklist.length > CHECKLIST_LIMIT ||
    !task.checklist.every(item => item && isShortText(item.id, 80) && item.id && isShortText(item.title, 140) && item.title.trim() && typeof item.done === "boolean") ||
    new Set(task.checklist.map(item => item.id)).size !== task.checklist.length ||
    !Number.isFinite(task.createdAt) || !Number.isFinite(task.updatedAt) ||
    (task.archived !== undefined && typeof task.archived !== "boolean") ||
    (task.repeatsFrom !== undefined && !isShortText(task.repeatsFrom, 80))
  ) throw new Error("Invalid task data.");
  const problem = validateTaskDraft(task);
  if (problem) throw new Error(problem);
  return {
    id: task.id, title: task.title.trim(), description: task.description, status: task.status,
    priority: task.priority, due: task.due, owner: task.owner.trim(),
    labels: taskLabels(task.labels.join(",")), checklist: task.checklist.map(({ id, title, done }) => ({ id, title, done })),
    repeat: task.repeat, createdAt: task.createdAt, updatedAt: task.updatedAt,
    ...(task.archived ? { archived: true } : {}),
    ...(task.repeatsFrom ? { repeatsFrom: task.repeatsFrom } : {}),
  };
}

export function readTasks(value: unknown): Task[] {
  if (!Array.isArray(value) || value.length > TASK_LIMIT) throw new Error("Invalid task list.");
  const tasks = value.map(normalizeTask);
  if (new Set(tasks.map(task => task.id)).size !== tasks.length) throw new Error("Duplicate task IDs.");
  return tasks;
}

export function saveTask(tasks: Task[], draft: TaskDraft, id?: string, now = Date.now()) {
  const existing = id ? tasks.find(task => task.id === id) : undefined;
  if (id && !existing) throw new Error("This task is no longer available.");
  const task = normalizeTask({
    ...existing, ...draft, id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? now, updatedAt: Math.max(now, (existing?.updatedAt ?? 0) + 1),
  });
  const next = existing ? tasks.map(item => item.id === id ? task : item) : [...tasks, task];
  if (task.status === "done" && existing?.status !== "done" && task.repeat !== "none" &&
    !next.some(item => item.repeatsFrom === task.id)) {
    const due = nextDate(task.due, task.repeat);
    if (due) next.push({
      ...task, id: crypto.randomUUID(), status: "todo", due, archived: undefined,
      checklist: task.checklist.map(item => ({ ...item, done: false })),
      createdAt: now, updatedAt: now, repeatsFrom: task.id,
    });
  }
  if (next.length > TASK_LIMIT) throw new Error("This board has reached its task limit. Permanently delete archived tasks to free space.");
  return next;
}

export function taskDueState(task: Task, today: string) {
  if (!task.due || task.status === "done" || task.archived) return "";
  return task.due < today ? "overdue" : task.due === today ? "today" : "";
}

export function tasksCsv(tasks: Task[]) {
  const cell = (value: string) => {
    const safe = /^(?:\s*[=+@-]|[\t\r\n])/.test(value) ? "'" + value : value;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const rows = tasks.map(task => [
    task.title, taskStatusLabel[task.status], task.priority, task.due, task.owner,
    task.labels.join(", "), task.description, task.repeat,
    task.checklist.map(item => `${item.done ? "[x]" : "[ ]"} ${item.title}`).join("\n"),
    task.archived ? "Yes" : "No",
  ]);
  return [["Title", "Status", "Priority", "Due date", "Owner", "Labels", "Description", "Repeat", "Checklist", "Archived"], ...rows]
    .map(row => row.map(cell).join(",")).join("\r\n");
}
