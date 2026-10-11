"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { FeaturePanel } from '@/components/dashboard/FeaturePanel';
import { dashboardAccents, dashboardCardSx, ghostActionButtonSx } from '@/components/dashboard/dashboardTheme';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { personalTodayApi, type PersonalToday, type TodayTask, type TodayReminder, type TodaySchedule } from '@/lib/api/personalToday';
import { userRemindersApi } from '@/lib/api/userReminders';
import type { DashboardMessageKey } from '@/lib/i18n/messages';
import { TaskEditorDialog } from '@/components/tasks/TaskEditorDialog';

type AgendaItem = { kind: 'task'; item: TodayTask } | { kind: 'reminder'; item: TodayReminder } | { kind: 'schedule'; item: TodaySchedule };
const accent = dashboardAccents.commands;
const actionSx = ghostActionButtonSx(accent);

export function TodayPanel({ revision, onRemindersChanged }: { revision?: string; onRemindersChanged?: () => void }) {
    const { t, formatDate } = useDashboardI18n();
    const [data, setData] = useState<PersonalToday | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState<TodayTask | null>(null);
    const [completed, setCompleted] = useState<{ id: string; title: string; version: number } | null>(null);
    const pending = useRef(false);
    const request = useRef(0);
    const load = useCallback(async () => {
        const sequence = ++request.current;
        setLoading(true);
        try {
            const next = await personalTodayApi.get();
            if (sequence === request.current) { setData(next); setError(null); }
        } catch (err) {
            if (sequence === request.current) setError(err instanceof Error ? err.message : t('today.failed'));
        } finally { if (sequence === request.current) setLoading(false); }
    }, [t]);
    useEffect(() => {
        void load();
        const refresh = () => { if (!document.hidden && !pending.current) void load(); };
        const interval = window.setInterval(refresh, 60_000);
        window.addEventListener('personal-today-refresh', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            request.current++;
            window.clearInterval(interval);
            window.removeEventListener('personal-today-refresh', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [load, revision]);

    async function run(action: () => Promise<unknown>, reminder = false) {
        if (pending.current) return;
        pending.current = true; setBusy(true); setError(null);
        request.current++;
        try {
            await action();
            if (reminder) onRemindersChanged?.();
            await load();
        } catch (err) { setError(err instanceof Error ? err.message : t('today.failed')); }
        finally { pending.current = false; setBusy(false); }
    }
    const disabled = busy || loading;
    const time = (at: number) => formatDate(at, { timeZone: data?.timezone ?? 'UTC', dateStyle: 'medium', timeStyle: 'short' });
    const agenda: AgendaItem[] = data ? [
        ...data.tasks.filter(item => item.dueAt !== null).map(item => ({ kind: 'task' as const, item })),
        ...data.reminders.map(item => ({ kind: 'reminder' as const, item })),
        ...data.schedules.map(item => ({ kind: 'schedule' as const, item })),
    ].sort((a, b) => timestamp(a) - timestamp(b) || a.item.id.localeCompare(b.item.id)) : [];
    const undated = data?.tasks.filter(item => item.dueAt === null) ?? [];

    function taskActions(task: TodayTask) {
        return <>
            {task.checklist.length > 0 && <Stack spacing={0.25}>
                {task.checklist.map((item, index) => <Stack key={index} direction="row" sx={{ alignItems: 'center', minWidth: 0 }}>
                    <Checkbox checked={item.done} disabled={disabled} slotProps={{ input: { 'aria-label': t('today.checkItem', { item: item.text }) } }}
                        onChange={() => void run(() => personalTodayApi.task(task.id, { action: 'check', version: task.version, index }))} sx={{ color: accent, '&.Mui-checked': { color: accent } }} />
                    <Typography sx={{ color: 'grey.300', overflowWrap: 'anywhere', textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</Typography>
                </Stack>)}
            </Stack>}
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                <Button disabled={disabled} onClick={() => setEditing(task)} sx={actionSx}>{t('taskEditor.edit')}</Button>
                <Button disabled={disabled} onClick={() => void run(async () => {
                    const saved = await personalTodayApi.task(task.id, { action: 'done', version: task.version });
                    if (saved.canUndo) setCompleted({ id: saved.id, title: saved.title, version: saved.version });
                    window.dispatchEvent(new Event('personal-today-refresh'));
                })} sx={actionSx}>{t('today.done')}</Button>
                <Button disabled={disabled} onClick={() => void run(() => personalTodayApi.task(task.id, { action: 'snooze', version: task.version, minutes: 60 }))} sx={actionSx}>{t('today.snooze')}</Button>
                <Button disabled={disabled} onClick={() => void run(async () => {
                    await personalTodayApi.task(task.id, { action: 'tomorrow', version: task.version });
                    window.dispatchEvent(new Event('personal-today-refresh'));
                })} sx={actionSx}>{t('today.tomorrow')}</Button>
                {safeSource(task.sourceUrl) && <Button component="a" href={safeSource(task.sourceUrl)!} target="_blank" rel="noopener noreferrer" sx={actionSx}>{t('today.source')}</Button>}
            </Stack>
        </>;
    }
    function renderAgenda(entry: AgendaItem) {
        const { item, kind } = entry;
        const at = timestamp(entry);
        const labels = { task: 'today.tasks', reminder: 'today.reminders', schedule: 'today.schedules' } as const;
        const allDay = kind === 'schedule' && item.allDay;
        return <TodayCard key={`${kind}:${item.id}`} title={item.title}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                <Chip size="small" label={t(labels[kind])} sx={{ color: 'grey.200' }} />
                {!allDay && at < (data?.now ?? 0) && <Chip size="small" label={t(kind === 'schedule' ? 'today.awaiting' : 'today.overdue')} sx={{ color: dashboardAccents.birthdays }} />}
                {kind === 'task' && item.recurring && <Chip size="small" label={t('today.recurring')} sx={{ color: 'grey.200' }} />}
            </Stack>
            <Typography sx={{ color: 'grey.300' }}>{kind === 'schedule' && item.allDay
                ? t('today.allDay', { day: formatDate(at, { timeZone: item.timezone, dateStyle: 'medium' }) })
                : t('today.due', { time: time(at) })}</Typography>
            {kind === 'task' && taskActions(item)}
            {kind === 'reminder' && <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                <Button disabled={disabled} onClick={() => void run(() => userRemindersApi.snoozeUserReminder(item.id, { timespan: '1h' }), true)} sx={actionSx}>{t('today.snooze')}</Button>
                <Button disabled={disabled} onClick={() => void run(() => userRemindersApi.deleteUserReminder(item.id), true)} sx={actionSx}>{t('today.dismiss')}</Button>
            </Stack>}
            {kind === 'schedule' && <>
                {item.nextNotifyAt !== null && item.nextNotifyAt > (data?.now ?? 0) && <Typography variant="body2" sx={{ color: 'grey.400' }}>{t('today.reminderAt', { time: time(item.nextNotifyAt) })}</Typography>}
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    <Button disabled={disabled} onClick={() => void run(() => personalTodayApi.schedule(item.id, { action: 'complete', version: item.version }))} sx={actionSx}>{t('today.complete')}</Button>
                    <Button disabled={disabled} onClick={() => void run(() => personalTodayApi.schedule(item.id, { action: 'snooze', version: item.version, minutes: 60 }))} sx={actionSx}>{t('today.remindLater')}</Button>
                </Stack>
            </>}
        </TodayCard>;
    }
    const session = data?.session;
    return <FeaturePanel accent={accent}>
        <Stack spacing={2.25} sx={{ position: 'relative', minWidth: 0 }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h5" sx={{ color: 'grey.50', fontWeight: 900 }}>{t('today.title')}</Typography>
                <Button disabled={disabled} onClick={() => void load()} sx={actionSx}>{t('today.refresh')}</Button>
            </Stack>
            {data && <Typography variant="body2" sx={{ color: 'grey.400', overflowWrap: 'anywhere' }}>{t('today.date', { day: data.day, timezone: data.timezone })}</Typography>}
            {error && <Alert severity="error">{error}</Alert>}
            {completed && <Alert severity="success" action={<Button disabled={disabled} onClick={() => void run(async () => {
                await personalTodayApi.task(completed.id, { action: 'undo', version: completed.version });
                setCompleted(null); window.dispatchEvent(new Event('personal-today-refresh'));
            })} sx={{ color: 'inherit', textTransform: 'none' }}>{t('today.undo')}</Button>} sx={{ flexWrap: { xs: 'wrap', sm: 'nowrap' },
                '& .MuiAlert-message': { overflowWrap: 'anywhere', minWidth: 0, flex: 1 },
                '& .MuiAlert-action': { flexBasis: { xs: '100%', sm: 'auto' }, ml: { xs: 0, sm: 2 }, justifyContent: 'flex-end' } }}>
                {t('today.completedTask', { title: completed.title })}
            </Alert>}
            {loading && <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><CircularProgress size={18} /><Typography sx={{ color: 'grey.300' }}>{t('today.loading')}</Typography></Stack>}
            {session && <TodayCard title={session.title}>
                <Typography sx={{ color: accent }}>{t('today.activeSession')} · {t(session.kind === 'gaming' ? 'today.gaming' : 'today.focus')} · {t(session.state === 'paused' ? 'today.paused' : session.phase === 'break' ? 'today.break' : 'today.running')}</Typography>
                <Typography sx={{ color: 'grey.300' }}>{t('today.elapsed', { minutes: Math.floor(session.workMs / 60_000) })}</Typography>
                {session.remainingMs !== null && <Typography sx={{ color: 'grey.300' }}>{t('today.remaining', { minutes: Math.ceil(session.remainingMs / 60_000) })}</Typography>}
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    <Button disabled={disabled} onClick={() => void run(() => personalTodayApi.session(session.id, { action: session.state === 'paused' ? 'resume' : 'pause', version: session.version }))} sx={actionSx}>{t(session.state === 'paused' ? 'today.resume' : 'today.pause')}</Button>
                    <Button disabled={disabled} onClick={() => void run(() => personalTodayApi.session(session.id, { action: 'stop', version: session.version }))} sx={actionSx}>{t('today.stop')}</Button>
                </Stack>
            </TodayCard>}
            {data && agenda.length === 0 && undated.length === 0 && !session && <Typography sx={{ color: 'grey.300' }}>{t('today.empty')}</Typography>}
            <AgendaSection title="today.agenda" items={agenda.map(renderAgenda)} />
            <AgendaSection title="today.undated" items={undated.map(task => <TodayCard key={task.id} title={task.title}>{taskActions(task)}</TodayCard>)} />
            <AgendaSection title="today.countdowns" items={(data?.countdowns ?? []).map(item => <TodayCard key={item.id} title={item.title}><Typography sx={{ color: 'grey.300' }}>{time(item.dueAt)}</Typography></TodayCard>)} />
            {editing && <TaskEditorDialog key={editing.id} task={editing} onClose={() => setEditing(null)} />}
        </Stack>
    </FeaturePanel>;
}

function timestamp(entry: AgendaItem) { return entry.kind === 'schedule' ? entry.item.plannedAt : entry.item.dueAt ?? Infinity; }
function safeSource(value: string | null): string | null {
    try {
        const url = value ? new URL(value) : null;
        return url && ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
}
function TodayCard({ title, children }: React.PropsWithChildren<{ title: string }>) {
    return <Box sx={{ ...dashboardCardSx(accent), p: 2 }}><Stack spacing={1} sx={{ position: 'relative', minWidth: 0 }}>
        <Typography sx={{ color: 'grey.50', fontWeight: 800, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{title}</Typography>{children}
    </Stack></Box>;
}
function AgendaSection({ title, items }: { title: DashboardMessageKey; items: React.ReactNode[] }) {
    const { t } = useDashboardI18n();
    const [page, setPage] = useState(1);
    const pages = Math.max(1, Math.ceil(items.length / 10));
    const current = Math.min(page, pages);
    if (!items.length) return null;
    return <Stack spacing={1.5}>
        <Typography variant="h6" sx={{ color: 'grey.50', fontWeight: 800 }}>{t(title)}</Typography>
        {items.slice((current - 1) * 10, current * 10)}
        {pages > 1 && <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
            <Button disabled={current <= 1} onClick={() => setPage(current - 1)} sx={actionSx}>{t('today.previous')}</Button>
            <Typography sx={{ color: 'grey.300' }}>{t('today.page', { page: current, pages })}</Typography>
            <Button disabled={current >= pages} onClick={() => setPage(current + 1)} sx={actionSx}>{t('today.next')}</Button>
        </Stack>}
    </Stack>;
}
