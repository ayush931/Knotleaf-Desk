import {test,expect} from 'bun:test';
import {createReminder,completeReminder,tickReminders,parseReminders,nextOccurrence,validateSchedule} from '../lib/reminders.ts';
const at=(s)=>+new Date(s);
const schedule={kind:'once',start:'2030-06-03',time:'09:00',days:[]};
const make=(s=schedule)=>createReminder('Review notes',s,5,true,at('2030-06-02T12:00:00'),'test');
test('one-time alarms persist overdue state and repeat only at the configured interval until done',()=>{
 const r=make(),due=at('2030-06-03T09:00:00');expect(tickReminders([r],due-1).alerts).toHaveLength(0);
 const first=tickReminders([r],due);expect(first.alerts).toHaveLength(1);expect(first.items[0].activeSince).toBe(due);
 const restored=parseReminders(JSON.stringify(first.items));expect(tickReminders(restored,due+299999).alerts).toHaveLength(0);
 expect(tickReminders(restored,due+300000).alerts).toHaveLength(1);
 const done=completeReminder(restored[0],due+300001);expect(done.nextDue).toBeNull();expect(done.activeSince).toBeNull();expect(tickReminders([done],due+99999999).alerts).toHaveLength(0);
});
test('missed alarms activate on reopening, without flooding all missed intervals',()=>{
 const r=make();const late=at('2030-06-06T17:00:00');const tick=tickReminders([r],late);expect(tick.alerts).toHaveLength(1);expect(tick.items[0].lastNotified).toBe(late);expect(tick.items[0].activeSince).toBe(r.nextDue);
});
test('weekly selected days skip unselected days and Done schedules the next future local occurrence',()=>{
 const s={...schedule,kind:'weekly',days:[1,3]};const r=make(s);
 expect(r.nextDue).toBe(at('2030-06-03T09:00:00'));
 expect(completeReminder(r,at('2030-06-03T10:00:00')).nextDue).toBe(at('2030-06-05T09:00:00'));
 expect(completeReminder(r,at('2030-06-07T10:00:00')).nextDue).toBe(at('2030-06-10T09:00:00'));
 expect(nextOccurrence(s,at('2030-06-03T08:59:59'))).toBe(r.nextDue);
});
test('date ranges include both boundaries and stop after the final daily occurrence',()=>{
 const s={...schedule,kind:'range',end:'2030-06-05'};const r=make(s);
 expect(completeReminder(r,at('2030-06-03T10:00:00')).nextDue).toBe(at('2030-06-04T09:00:00'));
 expect(completeReminder(r,at('2030-06-04T10:00:00')).nextDue).toBe(at('2030-06-05T09:00:00'));
 expect(completeReminder(r,at('2030-06-05T10:00:00')).nextDue).toBeNull();
});
test('invalid dates, empty weekdays, unsafe intervals and corrupt storage recover safely',()=>{
 for(const s of [{...schedule,start:'2030-02-30'},{...schedule,time:'24:00'},{...schedule,kind:'range',end:'2030-06-01'},{...schedule,kind:'weekly',days:[]}])expect(validateSchedule(s)).not.toBe('');
 for(const interval of [0,-1,181,NaN,1.5])expect(()=>createReminder('task',schedule,interval,true,0)).toThrow();
 expect(()=>createReminder('',schedule,5,true,0)).toThrow();expect(()=>createReminder('task',schedule,5,true,at('2030-06-04T10:00:00'))).toThrow();
 for(const raw of ['{','null','{}','[null,{},4]'])expect(parseReminders(raw)).toEqual([]);
 expect(parseReminders(JSON.stringify([{...make(),lastNotified:'bad'}]))).toEqual([]);
});
test('daily recurrence follows local wall-clock time across a daylight-saving transition',async()=>{
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync(process.execPath,['-e',`import {nextOccurrence} from './lib/reminders.ts';const s={kind:'range',start:'2030-03-09',end:'2030-03-11',time:'09:00',days:[]};const first=+new Date('2030-03-09T09:00:00');const next=nextOccurrence(s,first);if(new Date(next).getHours()!==9||next-first!==23*60*60*1000)process.exit(1);`],{cwd:process.cwd(),env:{...process.env,TZ:'America/New_York'},encoding:'utf8'});expect(result.status).toBe(0);
});

test('tasks can be completed early, skipping that occurrence while retaining the next repeat',()=>{
 const r=make({...schedule,kind:'range',end:'2030-06-05'});const early=completeReminder(r,at('2030-06-02T13:00:00'));expect(early.nextDue).toBe(at('2030-06-04T09:00:00'));expect(completeReminder(make(),at('2030-06-02T13:00:00')).nextDue).toBeNull();
});
