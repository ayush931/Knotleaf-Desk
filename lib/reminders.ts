/** Local-time schedules. An overdue occurrence stays active until explicitly completed. */
export const REMINDERS_KEY = 'knotleaf.reminders.v1';
export type ReminderSchedule = {
    kind: 'once' | 'range' | 'weekly';
    start: string;
    end?: string;
    time: string;
    days: number[];
};
export interface Reminder {
    id: string;
    title: string;
    schedule: ReminderSchedule;
    intervalMinutes: number;
    sound: boolean;
    nextDue: number | null;
    activeSince: number | null;
    lastNotified: number | null;
    completedAt: number | null;
}
export function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function validDate(value: unknown): value is string { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false; const d = new Date(`${value}T12:00:00`); return Number.isFinite(+d) && localDate(d) === value; }
export function validateSchedule(s: ReminderSchedule) {
    if (!['once', 'range', 'weekly'].includes(s.kind) || !validDate(s.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))
        return 'Choose a valid start date and time.';
    if (s.kind === 'range' && (!validDate(s.end) || s.end < s.start))
        return 'End date must be on or after the start date.';
    if (s.kind === 'weekly' && (!Array.isArray(s.days) || !s.days.length || s.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)))
        return 'Choose at least one repeat day.';
    return '';
}
export function nextOccurrence(s: ReminderSchedule, after: number): number | null {
    if (validateSchedule(s) || !Number.isFinite(after))
        return null;
    const cursor = new Date(Math.max(+new Date(`${s.start}T00:00:00`), after));
    cursor.setHours(12, 0, 0, 0);
    // Recurrence is daily or weekly; eight local calendar days always contain the next eligible day.
    for (let i = 0; i < 8; i++, cursor.setDate(cursor.getDate() + 1)) {
        const day = localDate(cursor);
        if (s.kind === 'once' && day !== s.start || s.kind === 'range' && day > s.end!)
            return null;
        if (s.kind === 'weekly' && !s.days.includes(cursor.getDay()))
            continue;
        const due = +new Date(`${day}T${s.time}:00`);
        if (due > after)
            return due;
    }
    return null;
}
export function createReminder(title: string, schedule: ReminderSchedule, intervalMinutes: number, sound: boolean, now = Date.now(), id = crypto.randomUUID()): Reminder {
    const error = validateSchedule(schedule);
    if (error)
        throw new Error(error);
    if (!title.trim() || title.trim().length > 200)
        throw new Error('Enter a task of up to 200 characters.');
    if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 180)
        throw new Error('Choose an alarm interval from 1 to 180 minutes.');
    const nextDue = nextOccurrence(schedule, now - 1);
    if (nextDue === null)
        throw new Error('Choose a future reminder time.');
    return { id, title: title.trim(), schedule, intervalMinutes, sound, nextDue, activeSince: null, lastNotified: null, completedAt: null };
}
export function completeReminder(r: Reminder, now = Date.now()): Reminder { return { ...r, nextDue: r.schedule.kind === 'once' ? null : nextOccurrence(r.schedule, Math.max(now, r.nextDue ?? now)), activeSince: null, lastNotified: null, completedAt: now }; }
export function tickReminders(items: Reminder[], now = Date.now()): {
    items: Reminder[];
    alerts: Reminder[];
} {
    const alerts: Reminder[] = [];
    const next = items.map(r => {
        if (r.nextDue === null || r.nextDue > now)
            return r;
        if (r.lastNotified !== null && now - r.lastNotified < r.intervalMinutes * 60000)
            return r;
        const active = { ...r, activeSince: r.activeSince ?? r.nextDue, lastNotified: now };
        alerts.push(active);
        return active;
    });
    return { items: next, alerts };
}
export function parseReminders(raw: string | null): Reminder[] {
    try {
        const data: unknown = JSON.parse(raw || '[]');
        if (!Array.isArray(data))
            return [];
        return data.filter((r): r is Reminder => !!r && typeof r === 'object' && typeof r.id === 'string' && typeof r.title === 'string' && r.title.trim().length > 0 && r.title.length <= 200 && r.schedule && !validateSchedule(r.schedule) && Number.isInteger(r.intervalMinutes) && r.intervalMinutes >= 1 && r.intervalMinutes <= 180 && typeof r.sound === 'boolean' && [r.nextDue, r.activeSince, r.lastNotified, r.completedAt].every(n => n === null || typeof n === 'number' && Number.isFinite(n)));
    }
    catch {
        return [];
    }
}
