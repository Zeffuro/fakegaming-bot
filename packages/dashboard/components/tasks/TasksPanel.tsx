"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { FeaturePanel } from '@/components/dashboard/FeaturePanel';
import { dashboardAccents, dashboardCardSx, ghostActionButtonSx } from '@/components/dashboard/dashboardTheme';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { userTasksApi, type EditableTask } from '@/lib/api/userTasks';
import { TaskEditorDialog } from './TaskEditorDialog';
import { ChecklistDialog } from './ChecklistDialog';
import { personalTodayApi } from '@/lib/api/personalToday';

export function TasksPanel() {
    const { t, formatDate } = useDashboardI18n();
    const [data, setData] = useState<Awaited<ReturnType<typeof userTasksApi.list>> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<EditableTask | null>(null);
    const [copying, setCopying] = useState<EditableTask | null>(null);
    const [pages, setPages] = useState({ active: 1, completed: 1 });
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const sequence = useRef(0);
    const load = useCallback(async () => {
        const request = ++sequence.current; setLoading(true);
        try { const next = await userTasksApi.list(); if (request === sequence.current) { setData(next); setError(null); } }
        catch (err) { if (request === sequence.current) setError(err instanceof Error ? err.message : t('taskEditor.failed')); }
        finally { if (request === sequence.current) setLoading(false); }
    }, [t]);
    useEffect(() => {
        void load();
        const refresh = () => void load();
        window.addEventListener('personal-today-refresh', refresh);
        return () => { sequence.current++; window.removeEventListener('personal-today-refresh', refresh); };
    }, [load]);
    const actionSx = ghostActionButtonSx(dashboardAccents.commands);
    async function act(task: EditableTask, action: 'undo' | 'tomorrow') {
        if (pending.current) return;
        pending.current = true; setBusy(true); setError(null); sequence.current++;
        try {
            await personalTodayApi.task(task.id, { action, version: task.version });
            window.dispatchEvent(new Event('personal-today-refresh'));
        } catch (err) { setError(err instanceof Error ? err.message : t('taskEditor.failed')); }
        finally { pending.current = false; setBusy(false); }
    }
    function section(kind: 'active' | 'completed') {
        const items = data?.[kind] ?? [];
        const count = Math.max(1, Math.ceil(items.length / 10));
        const current = Math.min(pages[kind], count);
        return <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{t(kind === 'active' ? 'taskEditor.active' : 'taskEditor.completed')}</Typography>
            {!items.length && !loading && <Typography sx={{ color: 'grey.300' }}>{t('taskEditor.empty')}</Typography>}
            {items.slice((current - 1) * 10, current * 10).map(task => <Box key={task.id} sx={{ ...dashboardCardSx(dashboardAccents.commands), p: 2 }}><Stack spacing={1} sx={{ position: 'relative', minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{task.title}</Typography>
                <Typography sx={{ color: 'grey.300' }}>{task.dueAt === null ? t('taskEditor.noDue') : formatDate(task.dueAt, { timeZone: data?.timezone ?? 'UTC', dateStyle: 'medium', timeStyle: 'short' })}</Typography>
                {task.checklist.map((item, index) => <Typography key={index} sx={{ color: 'grey.300', overflowWrap: 'anywhere', textDecoration: item.done ? 'line-through' : 'none' }}>{item.done ? '☑' : '☐'} {item.text}</Typography>)}
                {kind === 'active' && <Button disabled={loading || busy} onClick={() => setEditing(task)} sx={actionSx}>{t('taskEditor.edit')}</Button>}
                {kind === 'active' && <Button disabled={loading || busy} onClick={() => void act(task, 'tomorrow')} sx={actionSx}>{t('today.tomorrow')}</Button>}
                {task.canUndo && <Button disabled={loading || busy} onClick={() => void act(task, 'undo')} sx={actionSx}>{t('taskEditor.undo')}</Button>}
                {task.checklist.length > 0 && <Button disabled={loading || busy} onClick={() => setCopying(task)} sx={actionSx}>{t('checklists.saveTask')}</Button>}
            </Stack></Box>)}
            {count > 1 && <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                <Button disabled={current <= 1} onClick={() => setPages(value => ({ ...value, [kind]: current - 1 }))} sx={actionSx}>{t('taskEditor.previous')}</Button>
                <Typography>{t('taskEditor.page', { page: current, pages: count })}</Typography>
                <Button disabled={current >= count} onClick={() => setPages(value => ({ ...value, [kind]: current + 1 }))} sx={actionSx}>{t('taskEditor.next')}</Button>
            </Stack>}
        </Stack>;
    }
    return <FeaturePanel accent={dashboardAccents.commands}><Stack spacing={2.25} sx={{ position: 'relative', color: 'grey.50', minWidth: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>{t('taskEditor.title')}</Typography>
        <Typography sx={{ color: 'grey.300' }}>{t('taskEditor.description')}</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {loading && <CircularProgress size={20} />}
        {section('active')}{section('completed')}
        {editing && <TaskEditorDialog key={editing.id} task={editing} onClose={() => setEditing(null)} />}
        {copying && <ChecklistDialog initial={{ title: copying.title, items: copying.checklist.map(item => item.text) }} onClose={() => setCopying(null)}
            onSaved={() => window.dispatchEvent(new Event('personal-checklists-refresh'))} />}
    </Stack></FeaturePanel>;
}
