"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlarmClock, Check, X, Trash2, Volume2, Plus, CalendarDays, CheckCircle2, BellRing, Repeat2 } from 'lucide-react';
import { REMINDERS_KEY, localDate, createReminder, completeReminder, reopenReminder, parseReminders, tickReminders, reminderState, type Reminder, type ReminderSchedule } from '@/lib/reminders';
export function Reminders({ open, onClose }: {
    open: boolean;
    onClose: () => void;
}) {
    const [items, setItems] = useState<Reminder[]>([]), [error, setError] = useState(''), [notice, setNotice] = useState(''), [permission, setPermission] = useState(''), [soundReady, setSoundReady] = useState(false), [saveFailed, setSaveFailed] = useState(false), [completionNotice,setCompletionNotice]=useState<string|null>(null);
    const itemsRef = useRef(items), audio = useRef<AudioContext | null>(null), notifications = useRef(new Map<string, Notification>()), dialog = useRef<HTMLDialogElement>(null), close = useRef<HTMLButtonElement>(null), loaded = useRef(false), storageDirty = useRef(false), taskInput = useRef<HTMLInputElement>(null);
    const [title, setTitle] = useState(''), [kind, setKind] = useState<ReminderSchedule['kind']>('once'), [start, setStart] = useState(localDate(new Date())), [end, setEnd] = useState(localDate(new Date())), [time, setTime] = useState('09:00'), [days, setDays] = useState([1, 2, 3, 4, 5]), [interval, setIntervalMinutes] = useState(5), [sound, setSound] = useState(true);
    const publish = useCallback((next: Reminder[]) => { itemsRef.current = next; setItems(next); try {
        localStorage.setItem(REMINDERS_KEY, JSON.stringify(next));
        storageDirty.current = false;
        setSaveFailed(false);
        setError('');
        return true;
    }
    catch {
        storageDirty.current = true;
        setSaveFailed(true);
        setError('Reminders are running for this session only. Browser storage is unavailable; keep this tab open and retry saving.');
        return false;
    } }, []);
    const play = useCallback(() => {
        const ctx = audio.current;
        if (!ctx || ctx.state !== 'running') {
            setSoundReady(false);
            return;
        }
        for (let i = 0; i < 3; i++) {
            const oscillator = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + i * .4;
            oscillator.type = 'sine';
            oscillator.frequency.value = i === 1 ? 880 : 660;
            gain.gain.setValueAtTime(0, at);
            gain.gain.linearRampToValueAtTime(.18, at + .02);
            gain.gain.exponentialRampToValueAtTime(.001, at + .28);
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start(at);
            oscillator.stop(at + .3);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        }
    }, []);
    async function enableSound() { try {
        audio.current ??= new AudioContext();
        await audio.current.resume();
        setSoundReady(audio.current.state === 'running');
        play();
    }
    catch {
        setNotice('Sound is unavailable in this browser. Visual alarms will still appear.');
    } }
    async function enableNotifications() { if (!('Notification' in window)) {
        setPermission('unsupported');
        return;
    } try {
        setPermission(await Notification.requestPermission());
    }
    catch {
        setPermission('denied');
    } }
    useEffect(() => {
        const initialize = window.setTimeout(() => {
            try {
                const saved = parseReminders(localStorage.getItem(REMINDERS_KEY));
                itemsRef.current = saved;
                setItems(saved);
            }
            catch {
                setSaveFailed(true);
                setError('Could not read saved reminders. Browser storage is unavailable.');
            }
            loaded.current = true;
            setPermission('Notification' in window ? Notification.permission : 'unsupported');
        }, 0);
        const sync = (e: StorageEvent) => { if (e.key === REMINDERS_KEY || e.key === null) {
            const next = parseReminders(e.key === null ? null : e.newValue);
            itemsRef.current = next;
            setItems(next);
            for (const [id, n] of notifications.current)
                if (!next.some(r => r.id === id && r.activeSince !== null)) {
                    n.close();
                    notifications.current.delete(id);
                }
        } };
        window.addEventListener('storage', sync);
        const activeNotifications = notifications.current;
        return () => { window.clearTimeout(initialize); loaded.current = false; window.removeEventListener('storage', sync); activeNotifications.forEach(n => n.close()); activeNotifications.clear(); void audio.current?.close(); audio.current = null; };
    }, []);
    useEffect(() => {
        const tick = () => {
            if (!loaded.current)
                return;
            const result = tickReminders(itemsRef.current);
            if (!result.alerts.length)
                return;
            publish(result.items);
            if (result.alerts.some(r => r.sound))
                play();
            for (const r of result.alerts) {
                if (!('Notification' in window) || Notification.permission !== 'granted')
                    continue;
                try {
                    notifications.current.get(r.id)?.close();
                    const n = new Notification(r.title, { body: 'Open Knotleaf Desk and mark Done to stop this reminder.', tag: `knotleaf-${r.id}`, requireInteraction: true, icon: '/icons/icon-192.png', silent: !r.sound || audio.current?.state === 'running' });
                    n.onclick = () => { window.focus(); };
                    notifications.current.set(r.id, n);
                }
                catch { /* The persistent in-app alarm remains available. */ }
            }
        };
        // Serialize alarm claims across tabs where the Web Locks API is available.
        const run = () => { if (navigator.locks) {
            void navigator.locks.request('knotleaf-reminder-alarm', { ifAvailable: true }, lock => { if (!lock || !loaded.current)
                return; try {
                const raw = localStorage.getItem(REMINDERS_KEY);
                if (raw !== null && !storageDirty.current && raw !== JSON.stringify(itemsRef.current)) {
                    const saved = parseReminders(raw);
                    itemsRef.current = saved;
                    setItems(saved);
                }
            }
            catch { /* Use the session copy if storage is blocked. */ } tick(); }).catch(() => tick());
        }
        else
            tick(); };
        const timer = window.setInterval(run, 1000);
        const wake = () => run();
        window.addEventListener('focus', wake);
        document.addEventListener('visibilitychange', wake);
        return () => { window.clearInterval(timer); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
    }, [play, publish]);
    useLayoutEffect(() => { if (!open)
        return; const previous = document.activeElement, node = dialog.current; node?.showModal(); close.current?.focus({ preventScroll: true }); return () => { node?.close(); if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true }); }; }, [open]);
    useEffect(()=>{if(!completionNotice)return;const timer=window.setTimeout(()=>setCompletionNotice(null),8000);return()=>window.clearTimeout(timer);},[completionNotice]);
    function done(id: string) {
        const current=itemsRef.current.find(r=>r.id===id);if(!current||current.nextDue===null||(current.completedAt!==null&&current.activeSince===null))return;
        const completed=completeReminder(current);
        publish(itemsRef.current.map(r=>r.id===id?completed:r));
        notifications.current.get(id)?.close();notifications.current.delete(id);
        const message=completed.nextDue!==null?`Marked done. Next reminder: ${new Date(completed.nextDue).toLocaleString()}.`:'Marked done. No more reminders scheduled.';
        setNotice(message);setCompletionNotice(open?null:`${current.title}: ${message}`);
    }
    function undone(id:string){setCompletionNotice(null);publish(itemsRef.current.map(r=>r.id===id?reopenReminder(r):r));setNotice('Marked undone. The alarm will resume.');}
    function remove(id: string) { setCompletionNotice(null);publish(itemsRef.current.filter(r => r.id !== id)); notifications.current.get(id)?.close(); notifications.current.delete(id); }
    const active = items.filter(r => r.activeSince !== null);
    const upcoming=items.filter(r=>r.nextDue!==null).sort((a,b)=>Number(b.activeSince!==null)-Number(a.activeSince!==null)||(a.nextDue??0)-(b.nextDue??0));
    const finished=items.filter(r=>r.nextDue===null).sort((a,b)=>(b.completedAt??0)-(a.completedAt??0));
    const row = (r: Reminder) => <li key={r.id} data-reminder-state={reminderState(r)} className="reminder-item">
      <div aria-hidden="true" className="reminder-task-icon">{r.activeSince!==null?<BellRing/>:r.nextDue!==null?<CalendarDays/>:<CheckCircle2/>}</div>
      <div className="reminder-task-copy"><p className="reminder-task-title">{r.title}</p><p data-ui-tone={r.activeSince!==null?'pending':r.nextDue===null?'success':'info'} className="reminder-status">{r.activeSince!==null?'Alarm active':r.nextDue!==null?`Next reminder: ${new Date(r.nextDue).toLocaleString()}`:'Completed'}</p><p className="reminder-task-meta"><Repeat2 aria-hidden="true"/>{r.schedule.kind==='once'?'One time':r.schedule.kind==='range'?'Daily in date range':'Weekly'}<span>· every {r.intervalMinutes} min{r.sound?' · sound':''}</span></p></div>
      <div className="reminder-task-actions">{r.nextDue!==null&&(r.completedAt===null||r.activeSince!==null)&&<button data-ui-tone="success" type="button" className="ui-primary reminder-done" onClick={()=>done(r.id)}><Check aria-hidden="true"/>Done</button>}{r.completedAt!==null&&r.activeSince===null&&<button type="button" data-ui-tone="pending" aria-label={`${r.nextDue===null?'Mark undone':'Undo last completion'}: ${r.title}`} className="reminder-undo" onClick={()=>undone(r.id)}>{r.nextDue===null?'Mark undone':'Undo last completion'}</button>}<button data-ui-tone="danger" type="button" aria-label={`Delete reminder: ${r.title}`} className="reminder-delete" onClick={()=>remove(r.id)}><Trash2/></button></div>
    </li>;
    const acknowledgement=completionNotice&&<div className="flex items-start gap-3"><p role="status" className="min-w-0 flex-1 break-words text-xs">{completionNotice}</p><button type="button" aria-label="Dismiss reminder confirmation" onClick={()=>setCompletionNotice(null)} className="shrink-0 rounded p-1"><X className="h-4 w-4"/></button></div>;
    return <>
  {!open&&active.length===0&&completionNotice&&<aside aria-label="Reminder completion" className="reminder-confirmation workspace-surface drawing-panel fixed bottom-4 right-4 z-[100] w-[min(420px,calc(100vw-2rem))] rounded-xl border p-4 text-neutral-900 dark:text-white shadow-xl">{acknowledgement}{error&&<p role="alert" className="mt-2 text-xs">{error}</p>}</aside>}
  {active.length > 0 && !open && <aside aria-label="Active reminders" className="reminder-alarm workspace-surface drawing-panel fixed bottom-4 right-4 z-[100] w-[min(420px,calc(100vw-2rem))] max-h-[45dvh] overflow-auto rounded-xl border p-4 text-neutral-900 dark:text-white shadow-xl"><h2 role="status" className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlarmClock className="h-5 w-5"/>{active.length} reminder{active.length === 1 ? '' : 's'} waiting for Done</h2><ul>{active.map(row)}</ul>{acknowledgement}{!soundReady && active.some(r => r.sound) && <button type="button" onClick={enableSound} className="mt-2 text-xs underline">Enable alarm sound</button>}{error && <p role="alert" className="mt-2 text-xs">{error}</p>}</aside>}
  {open&&<dialog ref={dialog} aria-labelledby="reminders-title" onCancel={onClose} className="workspace-dialog workspace-surface drawing-panel reminder-dialog m-auto text-neutral-900 dark:text-white backdrop:bg-black/60">
    <header className="workspace-dialog-header"><div className="workspace-dialog-heading"><span className="workspace-heading-icon" aria-hidden="true"><AlarmClock/></span><div><h2 id="reminders-title">Reminders</h2><p>Tasks and repeating alarms, saved on this device.</p></div></div><div className="workspace-dialog-actions"><button type="button" className="ui-primary reminder-new" aria-label="New reminder" onClick={()=>taskInput.current?.focus()}><Plus aria-hidden="true"/><span>New reminder</span></button><button type="button" ref={close} onClick={onClose} aria-label="Close reminders" className="workspace-close"><X/></button></div></header>
    <div className="reminder-layout"><section className="reminder-list-pane" aria-label="Your reminders"><div className="reminder-section-heading"><h3>Your reminders <span>{items.length}</span></h3><p>{active.length?`${active.length} active · `:''}{upcoming.length-active.length} scheduled</p></div>
      {items.length===0?<div className="reminder-empty"><AlarmClock aria-hidden="true"/><h3>No reminders yet</h3><p>Add a task and choose when you want to be reminded.</p><button type="button" className="ui-primary" onClick={()=>taskInput.current?.focus()}>New reminder</button></div>:<>{upcoming.length>0&&<ul className="reminder-list">{upcoming.map(row)}</ul>}{finished.length>0&&<section className="reminder-completed"><h4>Completed <span>{finished.length}</span></h4><ul className="reminder-list">{finished.map(row)}</ul></section>}</>}
    </section><section className="reminder-compose-pane" aria-label="New reminder"><div className="reminder-section-heading"><h3>New reminder</h3><p>Choose when you want to be reminded.</p></div>
   <form noValidate aria-describedby={error?"reminders-error":undefined} onSubmit={event => { event.preventDefault(); try {
            const r = createReminder(title, { kind, start, end: kind === 'range' ? end : undefined, time, days }, interval, sound);
            const saved = publish([...itemsRef.current, r]);
            setTitle('');
            setNotice(saved ? 'Reminder saved on this device.' : 'Reminder added for this session.');
            if (sound)
                void enableSound();
        }
        catch (e) {
            setNotice('');
            setSaveFailed(false);
            const message = e instanceof Error ? e.message : 'Could not add reminder.';
            setError(message);
            const field = message.includes('task') ? 'title' : message.includes('interval') ? 'interval' : message.includes('End date') ? 'end' : message.includes('repeat day') ? 'repeat-day' : 'start';
            (event.currentTarget.elements.namedItem(field) as HTMLElement | null)?.focus?.();
        } }} className="grid gap-3">
    <label className="text-xs font-medium">Task<input ref={taskInput} name="title" required maxLength={200} aria-invalid={error.includes('Enter a task') || undefined} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Review the launch checklist" className="reminder-field mt-1 w-full"/></label>
    <label className="text-xs font-medium">Schedule<select value={kind} onChange={e => setKind(e.target.value as ReminderSchedule['kind'])} className="reminder-field mt-1 w-full"><option value="once">Specific date</option><option value="range">Every day in a date range</option><option value="weekly">Repeat on selected days</option></select></label>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-xs font-medium">{kind === 'once' ? 'Date' : 'Start date'}<input name="start" type="date" value={start} onChange={e => setStart(e.target.value)} className="reminder-field mt-1 w-full"/></label><label className="text-xs font-medium">Time<input type="time" value={time} onChange={e => setTime(e.target.value)} className="reminder-field mt-1 w-full"/></label>{kind === 'range' && <label className="text-xs font-medium">End date (inclusive)<input name="end" type="date" value={end} onChange={e => setEnd(e.target.value)} className="reminder-field mt-1 w-full"/></label>}</div>
    {kind === 'weekly' && <fieldset><legend className="mb-2 text-xs font-medium">Repeat days</legend><div className="flex flex-wrap gap-2">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => <label key={day} className="reminder-day rounded-md border px-2 py-2 text-xs"><input name={i === 0 ? "repeat-day" : undefined} type="checkbox" checked={days.includes(i)} onChange={e => setDays(e.target.checked ? [...days, i] : days.filter(d => d !== i))} className="mr-1"/>{day}</label>)}</div></fieldset>}
    <div className="flex flex-wrap items-end gap-4"><label className="text-xs font-medium">Repeat alarm every (minutes)<input name="interval" type="number" min={1} max={180} value={interval} onChange={e => setIntervalMinutes(e.target.valueAsNumber)} className="reminder-field mt-1 block w-28"/></label><label className="pb-2 text-xs"><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} className="mr-2"/>Play alarm sound</label></div>
    <p className="text-xs opacity-75">Once due, the alarm repeats at your interval until Done. Done stops today’s alarm; recurring tasks keep their next scheduled date.</p>
    <button data-ui-tone="info" type="submit" className="ui-primary justify-self-start rounded-md px-4 py-2 text-sm font-semibold">Add reminder</button>
   </form>
   {error && <p id="reminders-error" role="alert" className="mt-3 text-xs">{error}{saveFailed&&<button data-ui-tone="pending" type="button" onClick={() => publish(itemsRef.current)} className="ml-2 underline">Retry saving</button>}</p>}{notice && <p role="status" className="mt-3 text-xs">{notice}</p>}
      <details className="reminder-delivery"><summary>Sound & notifications<span>Optional setup</span></summary><div className="reminder-settings mb-4 rounded-lg border p-3 text-xs"><p>Keep Knotleaf open for alarms. Closed tabs, sleeping devices and browser settings can prevent notifications. Times use this device’s local time zone.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" data-ui-tone={permission==='granted'?'success':'info'} className="rounded-md border px-3 py-2" onClick={enableNotifications}>{permission === 'granted' ? 'Notifications enabled' : 'Enable notifications'}</button><button type="button" data-ui-tone={soundReady?'success':'pending'} className="rounded-md border px-3 py-2" onClick={enableSound}><Volume2 className="mr-1 inline h-3.5 w-3.5"/>{soundReady ? 'Test sound' : 'Enable & test sound'}</button></div>{permission === 'denied' && <p className="mt-2">Notifications are blocked. Allow them in your browser’s site settings. In-app alarms still work.</p>}{permission === 'unsupported' && <p className="mt-2">System notifications are unavailable here. In-app alarms still work.</p>}{!soundReady && <p className="mt-2">Enable sound after opening or reloading the app to allow audible alarms.</p>}</div></details>
    </section></div>
  </dialog>}
 </>;
}
