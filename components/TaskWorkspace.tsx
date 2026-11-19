"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Archive, CalendarDays, CheckCheck, Circle, CircleCheck, ClipboardList, Columns3,
  Download, Flag, GripVertical, List, ListChecks, Plus, Repeat2, Search, X,
} from "lucide-react";
import { TaskEditor } from "./TaskEditor";
import { boardStorageKey, getBoard, updateBoardContent } from "@/lib/storage";
import { safeFilename } from "@/lib/projectFile";
import {
  blankTask, localTaskDate, saveTask, taskDueState, tasksCsv, TASK_LIMIT, TASK_PRIORITIES, TASK_STATUSES,
  taskStatusLabel, type Task, type TaskDraft, type TaskStatus,
} from "@/lib/tasks";

const PAGE = 20;
const taskDragType = "application/x-knotleaf-task";
const dateLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
const shortcuts = [
  { id: "all", label: "All tasks", icon: ClipboardList },
  { id: "today", label: "Due today", icon: CalendarDays },
  { id: "overdue", label: "Overdue", icon: Flag },
  { id: "archive", label: "Archive", icon: Archive },
] as const;
type Scope = typeof shortcuts[number]["id"];
type Sort = "recent" | "due" | "priority" | "title";
type Editor = { task?: Task; status: TaskStatus };

function TaskMeta({ task, today }: { task: Task; today: string }) {
  const due = taskDueState(task, today);
  return (
    <span className="task-card-meta">
      {task.due && <span data-due={due}><CalendarDays size={13} />{due === "today" ? "Today" : dateLabel.format(new Date(task.due + "T12:00:00Z"))}
        {due === "overdue" && <span className="sr-only"> overdue</span>}
      </span>}
      {task.checklist.length > 0 && <span><ListChecks size={14} /><span className="sr-only">Checklist </span>{task.checklist.filter(item => item.done).length}/{task.checklist.length}</span>}
      {task.repeat !== "none" && <span title={`Repeats ${task.repeat}`}><Repeat2 size={13} /><span className="sr-only">Repeats {task.repeat}</span></span>}
    </span>
  );
}

export function TaskWorkspace({ boardId, title, initialTasks, onChange }: {
  boardId: string;
  title: string;
  initialTasks: Task[];
  onChange: (tasks: Task[]) => void;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [scope, setScope] = useState<Scope>("all");
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [owner, setOwner] = useState("");
  const [label, setLabel] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<string[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [dragged, setDragged] = useState("");
  const [dropStatus, setDropStatus] = useState<TaskStatus | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [today, setToday] = useState(() => localTaskDate());
  const search = useRef<HTMLInputElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const updateParent = useRef(onChange);
  const trigger = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => { updateParent.current = onChange; }, [onChange]);

  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key !== boardStorageKey(boardId)) return;
      const stored = getBoard(boardId);
      if (!stored) {
        setError("This board is no longer available on this device.");
        return;
      }
      setTasks(stored.tasks ?? []);
      updateParent.current(stored.tasks ?? []);
    };
    const calendar = () => setToday(localTaskDate());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", calendar);
    const timer = window.setInterval(calendar, 60000);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", calendar);
      clearInterval(timer);
    };
  }, [boardId]);

  const active = useMemo(() => tasks.filter(task => !task.archived), [tasks]);
  const statusTotals = TASK_STATUSES.map(value => active.filter(task => task.status === value).length);
  const dueToday = active.filter(task => taskDueState(task, today) === "today").length;
  const overdue = active.filter(task => taskDueState(task, today) === "overdue").length;
  const archiveCount = tasks.length - active.length;
  const owners = [...new Set(tasks.map(task => task.owner).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  const labels = [...new Map(tasks.flatMap(task => task.labels.map(value => [value.toLowerCase(), value] as const))).entries()].sort((a,b) => a[1].localeCompare(b[1]));
  const term = query.trim().toLowerCase();
  const filtered = tasks.filter(task => {
    if (Boolean(task.archived) !== (scope === "archive")) return false;
    if ((scope === "today" || scope === "overdue") && taskDueState(task, today) !== scope) return false;
    return (!priority || task.priority === priority) && (!status || task.status === status) &&
      (!owner || task.owner === owner) && (!label || task.labels.some(value => value.toLowerCase() === label)) &&
      (!term || [task.title, task.description, task.owner, ...task.labels, ...task.checklist.map(item => item.title)]
        .some(value => value.toLowerCase().includes(term)));
  }).sort((a, b) => {
    if (sort === "due") return (a.due || "z").localeCompare(b.due || "z") || b.updatedAt - a.updatedAt;
    if (sort === "priority") return TASK_PRIORITIES.indexOf(a.priority) - TASK_PRIORITIES.indexOf(b.priority) || b.updatedAt - a.updatedAt;
    return sort === "title" ? a.title.localeCompare(b.title) : b.updatedAt - a.updatedAt;
  });
  const listMode = view === "list" || scope === "archive";
  const visible = filtered.slice(0, limit);
  const chosen = new Set(visible.filter(task => selected.includes(task.id)).map(task => task.id));
  const hasFilters = !!(query || priority || status || owner || label);

  function resetResults() { setLimit(PAGE); setSelected([]); }
  function resetFilters() {
    setQuery(""); setPriority(""); setStatus(""); setOwner(""); setLabel(""); resetResults();
  }
  function showScope(next: Scope) { setScope(next); setStatus(""); resetResults(); }
  function open(next: Editor) {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditor(next);
  }
  function close() {
    setEditor(null);
    requestAnimationFrame(() => {
      if (trigger.current?.isConnected) trigger.current.focus();
      else newButton.current?.focus();
    });
  }
  function commit(change: (current: Task[]) => Task[], success: string) {
    const next = updateBoardContent(boardId, "tasks", change);
    setTasks(next);
    onChange(next);
    setError("");
    setNotice(success);
  }
  function run(change: (current: Task[]) => Task[], success: string) {
    try { commit(change, success); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the changes."); return false; }
  }
  function latest(current: Task[], original: Task) {
    const task = current.find(value => value.id === original.id);
    if (task?.updatedAt !== original.updatedAt) throw new Error("This task changed elsewhere. Close it and reopen the latest version.");
    return task;
  }
  function changeArchive(current: Task[], ids: Set<string>, archived: boolean) {
    return current.map(task => ids.has(task.id) ? { ...task, archived, updatedAt: Math.max(Date.now(), task.updatedAt + 1) } : task);
  }
  function editTask(draft: TaskDraft) {
    const original = editor?.task;
    commit(current => {
      if (original) latest(current, original);
      return saveTask(current, draft, original?.id);
    }, original ? "Task updated." : "Task created.");
    if (!original && scope === "archive") showScope("all");
    close();
  }
  function move(id: string, next: TaskStatus) {
    const currentTask = tasks.find(task => task.id === id);
    if (!currentTask || currentTask.status === next || currentTask.archived) return;
    run(current => {
      const task = latest(current, currentTask);
      return saveTask(current, { ...task, status: next }, id);
    }, `Task moved to ${taskStatusLabel[next]}.`);
  }
  function bulk(action: "done" | "archive" | "restore") {
    const count = chosen.size;
    if (!count) return;
    const ok = run(current => {
      for (const task of visible) if (chosen.has(task.id)) latest(current, task);
      if (action !== "done") return changeArchive(current, chosen, action === "archive");
      return current.filter(task => chosen.has(task.id) && task.status !== "done")
        .reduce((next, task) => saveTask(next, { ...task, status: "done" }, task.id), current);
    }, `${count} ${count === 1 ? "task" : "tasks"} ${action === "done" ? "completed" : action === "archive" ? "archived" : "restored"}.`);
    if (ok) setSelected([]);
  }
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([tasksCsv(filtered)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFilename(title)}-tasks.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="task-workspace" aria-labelledby={titleId} onKeyDown={event => {
      if (editor || event.nativeEvent.isComposing || event.metaKey || event.ctrlKey || event.altKey ||
        (event.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "/") { event.preventDefault(); search.current?.focus(); }
      if (event.key === "n" && tasks.length < TASK_LIMIT) { event.preventDefault(); open({ status: "todo" }); }
    }}>
      <div className="task-shell">
        <header className="task-masthead">
          <div className="task-identity">
            <span className="task-identity-icon"><ClipboardList size={22} aria-hidden="true" /></span>
            <div><h1 id={titleId}>Tasks</h1><p>{title} <span aria-hidden="true">·</span> On this device</p></div>
          </div>
          <div className="task-action-group">
            <button className="task-control" type="button" disabled={!filtered.length} onClick={exportCsv}><Download size={15} /> Export CSV</button>
            <button className="task-control ui-primary" ref={newButton} type="button" disabled={tasks.length >= TASK_LIMIT}
              onClick={() => open({ status: "todo" })}><Plus size={17} /> New task</button>
          </div>
        </header>

        <section className="task-progress-panel" aria-label="Workflow progress">
          <div className="task-progress-summary">
            <div className="task-completion-number">{active.length ? Math.round(statusTotals[3] / active.length * 100) : 0}<span>%</span></div>
            <div><strong>Complete</strong><p>{statusTotals[3]} of {active.length} tasks done</p></div>
          </div>
          <div className="task-progress-track">
            <div className="task-progress-strip" aria-hidden="true">
              {TASK_STATUSES.map((value, index) => statusTotals[index] > 0 && <span key={value} data-task-status={value} style={{ flex: statusTotals[index] }} />)}
            </div>
            <div className="task-progress-legend">
              {TASK_STATUSES.map((value, index) => (
                <button key={value} type="button" className="task-status-chip" data-task-status={value}
                  aria-pressed={scope === "all" && status === value}
                  onClick={() => { setScope("all"); setStatus(scope === "all" && status === value ? "" : value); resetResults(); }}>
                  <span className="task-dot" /> {taskStatusLabel[value]} <b>{statusTotals[index]}</b>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="task-toolbar">
          <nav aria-label="Task shortcuts" className="task-scopes">
            {shortcuts.map(({ id, label: name, icon: Icon }, index) => (
              <button type="button" key={id} aria-pressed={scope === id} className="task-control" onClick={() => showScope(id)}>
                <Icon size={15} /> {name} <span className="task-count">{[active.length, dueToday, overdue, archiveCount][index]}</span>
              </button>
            ))}
          </nav>
          {scope !== "archive" && <div role="group" aria-label="Task layout" className="task-view-switch">
            <button type="button" className="task-control" aria-pressed={view === "board"} onClick={() => { setView("board"); resetResults(); }}><Columns3 size={15} /> Board</button>
            <button type="button" className="task-control" aria-pressed={view === "list"} onClick={() => { setView("list"); resetResults(); }}><List size={16} /> List</button>
          </div>}
        </div>
        <div className="task-filters">
          <div className="task-search">
            <Search size={16} aria-hidden="true" />
            <input ref={search} type="search" aria-label="Search tasks" placeholder="Search tasks…" value={query}
              onChange={event => { setQuery(event.target.value); resetResults(); }} />
            {query && <button type="button" className="task-control" aria-label="Clear task search"
              onClick={() => { setQuery(""); resetResults(); search.current?.focus(); }}><X size={14} /></button>}
          </div>
          <select aria-label="Filter by status" value={status} onChange={event => { setStatus(event.target.value); resetResults(); }}>
            <option value="">All statuses</option>{TASK_STATUSES.map(value => <option key={value} value={value}>{taskStatusLabel[value]}</option>)}
          </select>
          <select aria-label="Filter by priority" value={priority} onChange={event => { setPriority(event.target.value); resetResults(); }}>
            <option value="">All priorities</option>{TASK_PRIORITIES.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
          </select>
          <select aria-label="Filter by owner" value={owner} onChange={event => { setOwner(event.target.value); resetResults(); }}>
            <option value="">All owners</option>{owners.map(value => <option key={value}>{value}</option>)}
          </select>
          <select aria-label="Filter by label" value={label} onChange={event => { setLabel(event.target.value); resetResults(); }}>
            <option value="">All labels</option>{labels.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
          <select aria-label="Sort tasks" value={sort} onChange={event => { setSort(event.target.value as Sort); resetResults(); }}>
            <option value="recent">Recently updated</option><option value="due">Due date</option><option value="priority">Priority</option><option value="title">Title A–Z</option>
          </select>
          {hasFilters && <button type="button" className="task-control" onClick={resetFilters}>Clear filters</button>}
        </div>

        <div className="task-feedback">
          <span role="status">{notice}</span>
          {error && <p role="alert" className="task-error">{error}</p>}
          {tasks.length >= TASK_LIMIT && <p>Task limit reached. Delete an archived task to free up space.</p>}
        </div>
        {chosen.size > 0 && <div className="task-bulk" aria-label="Selected task actions">
          <strong>{chosen.size} selected</strong>
          {scope !== "archive" && <button type="button" className="task-control" onClick={() => bulk("done")}><CheckCheck size={15} /> Mark done</button>}
          <button type="button" className="task-control" onClick={() => bulk(scope === "archive" ? "restore" : "archive")}>
            <Archive size={15} /> {scope === "archive" ? "Restore selected" : "Archive selected"}
          </button>
          <button type="button" className="task-control" onClick={() => setSelected([])}>Clear selection</button>
        </div>}

        {!filtered.length && (hasFilters || scope !== "all") ? <div className="task-no-results">
          <ClipboardList size={26} aria-hidden="true" />
          <h2>{hasFilters ? "No matching tasks" : scope === "archive" ? "No archived tasks" : scope === "today" ? "Nothing due today" : "Nothing overdue"}</h2>
          {hasFilters && <button type="button" className="task-control" onClick={resetFilters}>Clear filters</button>}
        </div> : listMode ? (
          <div className="task-list" tabIndex={0} role="region" aria-label="Scrollable task list">
            <table>
              <caption className="sr-only">Tasks on this board</caption>
              <thead><tr>
                <th scope="col"><input aria-label="Select all visible tasks" type="checkbox" disabled={!visible.length}
                  checked={!!visible.length && chosen.size === visible.length}
                  ref={input => { if (input) input.indeterminate = chosen.size > 0 && chosen.size < visible.length; }}
                  onChange={event => setSelected(event.target.checked ? visible.map(task => task.id) : [])} /></th>
                <th scope="col">Task</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Due date</th><th scope="col">Owner</th>
              </tr></thead>
              <tbody>{visible.map(task => (
                <tr key={task.id} data-selected={chosen.has(task.id)}>
                  <td><input type="checkbox" aria-label={`Select ${task.title}`} checked={chosen.has(task.id)} onChange={event => {
                    setSelected(event.target.checked ? [...selected, task.id] : selected.filter(id => id !== task.id));
                  }} /></td>
                  <td><button className="task-row-title" onClick={() => open({ task, status: task.status })}>{task.title}</button>
                    {task.labels.length > 0 && <div className="task-labels">{task.labels.map(value => <span key={value}>{value}</span>)}</div>}
                  </td>
                  <td><span className="task-list-status" data-task-status={task.status}><span className="task-dot" />{taskStatusLabel[task.status]}</span></td>
                  <td><span className="task-priority" data-priority={task.priority}><Flag size={13} />{task.priority}</span></td>
                  <td><TaskMeta task={task} today={today} /></td><td>{task.owner || "—"}</td>
                </tr>
              ))}</tbody>
            </table>
            {!visible.length && <p className="task-list-empty">Create your first task to get started.</p>}
            {filtered.length > visible.length && <div className="task-load-more">
              <span>{visible.length} of {filtered.length} tasks</span><button type="button" className="task-control" onClick={() => setLimit(limit + PAGE)}>Load more</button>
            </div>}
          </div>
        ) : (
          <div className="task-kanban">
            {TASK_STATUSES.filter(value => !status || status === value).map(value => {
              const column = filtered.filter(task => task.status === value);
              return <section key={value} className="task-column" data-task-status={value} data-drop={dropStatus === value}
                aria-label={taskStatusLabel[value]}
                onDragOver={event => {
                  if (!dragged || !event.dataTransfer.types.includes(taskDragType)) return;
                  event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropStatus(value);
                }}
                onDragLeave={event => {
                  if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropStatus(null);
                }}
                onDrop={event => {
                  const id = event.dataTransfer.getData(taskDragType);
                  if (!dragged || id !== dragged) return;
                  event.preventDefault(); setDragged(""); setDropStatus(null); move(id, value);
                }}>
                <header><div><span className="task-dot" /><h2>{taskStatusLabel[value]}</h2><span className="task-count">{column.length}</span></div>
                  <button type="button" className="task-control" aria-label={`Add task to ${taskStatusLabel[value]}`} disabled={tasks.length >= TASK_LIMIT}
                    onClick={() => open({ status: value })}><Plus size={16} /></button>
                </header>
                {column.slice(0, limit).map(task => <button type="button" className="task-card" key={task.id} draggable
                  onClick={() => open({ task, status: task.status })}
                  onDragStart={event => { event.dataTransfer.setData(taskDragType, task.id); event.dataTransfer.effectAllowed = "move"; setDragged(task.id); }}
                  onDragEnd={() => { setDragged(""); setDropStatus(null); }}>
                  <span className="task-card-head">
                    <span className="task-priority" data-priority={task.priority}><Flag size={12} />{task.priority}</span>
                    <GripVertical size={15} className="task-grip" aria-hidden="true" />
                  </span>
                  <strong>{task.title}</strong>
                  {task.description && <span className="task-card-description">{task.description}</span>}
                  {task.labels.length > 0 && <span className="task-labels">{task.labels.map(name => <span key={name}>{name}</span>)}</span>}
                  <span className="task-card-footer">
                    <TaskMeta task={task} today={today} />
                    {task.owner && <span className="task-owner" title={task.owner} aria-label={`Owner ${task.owner}`}>{task.owner.split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join("").toUpperCase()}</span>}
                  </span>
                </button>)}
                {!column.length && <div className="task-column-empty">{value === "done" ? <CircleCheck size={19} /> : <Circle size={17} />}<span>{value === "done" ? "No completed tasks" : "No tasks here"}</span></div>}
                {column.length > limit && <button type="button" className="task-control" onClick={() => setLimit(limit + PAGE)}>Load more · {column.length - limit} remaining</button>}
              </section>;
            })}
          </div>
        )}
      </div>
      {editor && <TaskEditor task={editor.task} status={editor.status} onClose={close} onSave={editTask}
        onArchive={() => {
          const task = editor.task!;
          commit(current => { latest(current, task); return changeArchive(current, new Set([task.id]), !task.archived); }, task.archived ? "Task restored." : "Task archived.");
          close();
        }}
        onDuplicate={() => {
          const task = editor.task!;
          const copy = { ...blankTask(), title: `${task.title.slice(0, 133)} (copy)`, description: task.description, priority: task.priority,
            due: task.due, owner: task.owner, labels: task.labels, checklist: task.checklist.map(item => ({ ...item, done: false })) };
          commit(current => { latest(current, task); return saveTask(current, copy); }, "Task duplicated in To do.");
          close();
        }}
        onDelete={() => {
          const task = editor.task!;
          commit(current => {
            if (!latest(current, task).archived) throw new Error("Archive the task before permanently deleting it.");
            return current.filter(value => value.id !== task.id);
          }, "Archived task deleted.");
          close();
        }} />}
    </section>
  );
}
