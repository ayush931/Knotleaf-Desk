"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Archive, ClipboardList, Copy, Plus, RotateCcw, Trash2, X } from "lucide-react";
import {
  blankTask, CHECKLIST_LIMIT, taskLabels, TASK_PRIORITIES, TASK_REPEATS, TASK_STATUSES,
  taskStatusLabel, validateTaskDraft, type Task, type TaskDraft, type TaskStatus,
} from "@/lib/tasks";

export function TaskEditor({
  task, status, onClose, onSave, onArchive, onDuplicate, onDelete,
}: {
  task?: Task;
  status: TaskStatus;
  onClose: () => void;
  onSave: (draft: TaskDraft) => void;
  onArchive: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [initial] = useState(() => task ?? blankTask(status));
  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [labels, setLabels] = useState(initial.labels.join(", "));
  const [item, setItem] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"discard" | "delete" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const dueInput = useRef<HTMLInputElement>(null);
  const checklistInput = useRef<HTMLInputElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const errorId = useId();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || labels !== initial.labels.join(", ") || Boolean(item.trim());
  const titleInvalid = error === "Enter a task title.";
  const dueInvalid = error === "Enter a valid due date." || error === "Add a due date for this repeating task.";
  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => { modal?.close(); };
  }, []);

  useEffect(() => {
    if (confirm) keepEditing.current?.focus();
  }, [confirm]);

  function update<K extends keyof TaskDraft>(field: K, value: TaskDraft[K]) {
    setDraft(current => ({ ...current, [field]: value }));
    setError("");
  }
  function commit(action: () => void) {
    try { action(); } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the task.");
    }
  }
  function requestClose() {
    if (confirm) setConfirm(null);
    else if (dirty) setConfirm("discard");
    else onClose();
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checklist = item.trim() && draft.checklist.length < CHECKLIST_LIMIT
      ? [...draft.checklist, { id: crypto.randomUUID(), title: item.trim(), done: false }]
      : draft.checklist;
    const next = { ...draft, checklist, labels: taskLabels(labels) };
    const problem = validateTaskDraft(next);
    if (problem) {
      setError(problem);
      (draft.title.trim() ? dueInput : titleInput).current?.focus();
      return;
    }
    commit(() => onSave(next));
  }
  function addItem() {
    if (!item.trim() || draft.checklist.length >= CHECKLIST_LIMIT) return;
    update("checklist", [...draft.checklist, { id: crypto.randomUUID(), title: item.trim(), done: false }]);
    setItem("");
    checklistInput.current?.focus();
  }
  const completed = draft.checklist.filter(entry => entry.done).length;
  return (
    <dialog ref={dialog} className="task-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); requestClose(); }}>
      <form noValidate onSubmit={save}>
        <header className="workspace-dialog-header">
          <div className="workspace-dialog-heading">
            <span className="workspace-heading-icon"><ClipboardList aria-hidden="true" /></span>
            <div>
              <h2 id={titleId}>{task ? "Task details" : "New task"}</h2>
              <p>{task?.archived ? "Archived task" : task ? taskStatusLabel[task.status] : "Add a task to this board."}</p>
            </div>
          </div>
          <button type="button" className="task-control" aria-label="Close task details" onClick={requestClose}><X size={17} /></button>
        </header>
        <div className="task-form-body">
          <label className="task-field">Title
            <input autoFocus ref={titleInput} required maxLength={140} value={draft.title} placeholder="What needs to happen?"
              aria-invalid={titleInvalid || undefined} aria-describedby={titleInvalid ? errorId : undefined}
              onChange={event => update("title", event.target.value)} />
          </label>
          <div className="task-field-grid">
            <label className="task-field">Status
              <select value={draft.status} onChange={event => update("status", event.target.value as TaskDraft["status"])}>
                {TASK_STATUSES.map(value => <option key={value} value={value}>{taskStatusLabel[value]}</option>)}
              </select>
            </label>
            <label className="task-field">Priority
              <select value={draft.priority} onChange={event => update("priority", event.target.value as TaskDraft["priority"])}>
                {TASK_PRIORITIES.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
              </select>
            </label>
            <label className="task-field">Due date
              <input type="date" ref={dueInput} value={draft.due} max="9999-12-31" onChange={event => update("due", event.target.value)}
                aria-invalid={dueInvalid || undefined} aria-describedby={dueInvalid ? errorId : undefined} />
            </label>
            <label className="task-field">Repeat
              <select value={draft.repeat} onChange={event => update("repeat", event.target.value as TaskDraft["repeat"])}>
                {TASK_REPEATS.map(value => <option key={value} value={value}>{value === "none" ? "Does not repeat" : value[0].toUpperCase() + value.slice(1)}</option>)}
              </select>
            </label>
            <label className="task-field">Owner
              <input maxLength={80} value={draft.owner} onChange={event => update("owner", event.target.value)} placeholder="Name" />
            </label>
            <label className="task-field">Labels
              <input maxLength={280} value={labels} onChange={event => setLabels(event.target.value)} placeholder="Design, research…" />
              <span className="sr-only">Separate up to eight labels with commas.</span>
            </label>
          </div>
          <label className="task-field">Description
            <textarea className="resize-none" rows={3} maxLength={5000} value={draft.description} onChange={event => update("description", event.target.value)} placeholder="Add context or acceptance criteria…" />
          </label>
          <fieldset className="task-checklist">
            <legend>Checklist {draft.checklist.length > 0 && <span>{completed}/{draft.checklist.length}</span>}</legend>
            {draft.checklist.length > 0 && <progress value={completed} max={draft.checklist.length} aria-label="Checklist completion" />}
            {draft.checklist.map(entry => (
              <div className="task-checklist-row" key={entry.id}>
                <label><input type="checkbox" checked={entry.done} onChange={event => {
                  const done = event.target.checked;
                  update("checklist", draft.checklist.map(value => value.id === entry.id ? { ...value, done } : value));
                }} /><span>{entry.title}</span></label>
                <button type="button" className="task-control" aria-label={`Remove ${entry.title}`}
                  onClick={() => update("checklist", draft.checklist.filter(value => value.id !== entry.id))}><X size={14} /></button>
              </div>
            ))}
            <div className="task-checklist-add">
              <input ref={checklistInput} aria-label="New checklist item" maxLength={140} value={item} placeholder="Add a checklist item"
                disabled={draft.checklist.length >= CHECKLIST_LIMIT} onChange={event => setItem(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addItem(); }
                }} />
              <button type="button" className="task-control" onClick={addItem} disabled={!item.trim() || draft.checklist.length >= CHECKLIST_LIMIT}><Plus size={15} /> Add</button>
            </div>
          </fieldset>
          {error && <p role="alert" id={errorId} className="task-error">{error}</p>}
          {confirm && (
            <div className="task-confirm">
              <p>{confirm === "delete" ? "Permanently delete this archived task?" : "Discard unsaved changes?"}</p>
              <button type="button" className="task-control" ref={keepEditing} onClick={() => { setConfirm(null); titleInput.current?.focus(); }}>Keep editing</button>
              <button type="button" className="task-control" data-task-danger onClick={() => commit(confirm === "delete" ? onDelete : onClose)}>
                {confirm === "delete" ? "Permanently delete" : "Discard changes"}
              </button>
            </div>
          )}
        </div>
        <footer className="task-dialog-footer">
          {task && <div className="task-action-group">
            <button type="button" className="task-control" disabled={dirty || !!confirm} onClick={() => commit(onArchive)}>
              {task.archived ? <RotateCcw size={15} /> : <Archive size={15} />} {task.archived ? "Restore" : "Archive"}
            </button>
            {task.archived
              ? <button type="button" className="task-control" disabled={dirty || !!confirm} onClick={() => setConfirm("delete")}><Trash2 size={15} /> Delete</button>
              : <button type="button" className="task-control" disabled={dirty || !!confirm} onClick={() => commit(onDuplicate)}><Copy size={15} /> Duplicate</button>}
          </div>}
          <div className="task-action-group">
            <button type="button" className="task-control" onClick={requestClose}>Cancel</button>
            <button type="submit" className="task-control ui-primary" disabled={!!confirm}>{task ? "Save changes" : "Create task"}</button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
