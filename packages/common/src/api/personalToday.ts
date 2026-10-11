export interface TodayTask {
    id: string; title: string; dueAt: number | null; version: number; recurring: boolean;
    checklist: { text: string; done: boolean }[]; sourceUrl: string | null;
}
export interface TodayReminder { id: string; title: string; dueAt: number }
export interface TodaySchedule {
    id: string; title: string; plannedAt: number; endAt: number | null; allDay: boolean;
    timezone: string; version: number; nextNotifyAt: number | null;
}
export interface TodayCountdown { id: string; title: string; dueAt: number }
export interface TodaySession {
    id: string; title: string; kind: 'focus' | 'gaming'; state: 'running' | 'paused';
    phase: 'focus' | 'break'; workMs: number; breakElapsedMs: number; remainingMs: number | null; version: number;
}
export interface PersonalToday {
    now: number; day: string; timezone: string; tasks: TodayTask[]; reminders: TodayReminder[];
    schedules: TodaySchedule[]; countdowns: TodayCountdown[]; session: TodaySession | null;
}
export type TodayTaskAction = { action: 'done' | 'undo' | 'tomorrow'; version: number }
    | { action: 'snooze'; version: number; minutes: number }
    | { action: 'check'; version: number; index: number };
export type TodayScheduleAction = { action: 'complete'; version: number }
    | { action: 'snooze'; version: number; minutes: number };
export interface TodaySessionAction { action: 'pause' | 'resume' | 'stop'; version: number }
