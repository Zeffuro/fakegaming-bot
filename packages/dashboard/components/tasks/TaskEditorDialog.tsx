"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx } from '@/components/dashboard/dashboardTheme';
import { userTasksApi, type EditableTask } from '@/lib/api/userTasks';
import { userSettingsApi } from '@/lib/api/userSettings';

function localDue(timestamp: number | null, timezone: string): string {
    if (timestamp === null) return '';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(timestamp);
    const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

export function TaskEditorDialog({ task, onClose, onSaved }: { task: Pick<EditableTask, 'id' | 'title' | 'checklist' | 'dueAt' | 'version'>; onClose: () => void; onSaved?: () => void }) {
    const { t } = useDashboardI18n();
    const [title, setTitle] = useState(task.title);
    const [checklist, setChecklist] = useState(task.checklist.map(item => ({ ...item })));
    const [due, setDue] = useState('');
    const [timezone, setTimezone] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const originalDue = useRef('');
    useEffect(() => {
        let active = true;
        void userSettingsApi.getUserSettings().then(settings => {
            if (!active) return;
            const zone = settings.timezone?.trim() || 'UTC';
            originalDue.current = localDue(task.dueAt, zone);
            setDue(originalDue.current); setTimezone(zone);
        }).catch(err => { if (active) setError(err instanceof Error ? err.message : t('taskEditor.failed')); });
        return () => { active = false; };
    }, [task.dueAt, t]);

    async function save() {
        if (pending.current || !timezone || !title.trim() || checklist.some(item => !item.text.trim())) return;
        pending.current = true; setBusy(true); setError(null);
        try {
            await userTasksApi.edit(task.id, { version: task.version, title: title.trim(),
                checklist: checklist.map(item => ({ ...item, text: item.text.trim() })), timezone,
                ...(due !== originalDue.current ? { due: due || null } : {}) });
            window.dispatchEvent(new Event('personal-today-refresh'));
            onSaved?.(); onClose();
        } catch (err) { setError(err instanceof Error ? err.message : t('taskEditor.failed')); }
        finally { pending.current = false; setBusy(false); }
    }
    const fieldSx = dashboardFieldSx(dashboardAccents.commands);
    const actionSx = ghostActionButtonSx(dashboardAccents.commands);
    return <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!pending.current) onClose(); }}
        slotProps={{ paper: { sx: { bgcolor: '#101725', color: 'grey.50', backgroundImage: 'none', m: { xs: 1, sm: 3 }, width: { xs: 'calc(100% - 16px)', sm: '100%' } } } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>{t('taskEditor.edit')}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label={t('taskEditor.titleLabel')} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} slotProps={{ htmlInput: { maxLength: 120 } }} sx={fieldSx} />
            <TextField type="datetime-local" label={t('taskEditor.dueLabel')} value={due} disabled={busy || timezone === null}
                onChange={event => setDue(event.target.value)} helperText={t('taskEditor.dueHelp')} slotProps={{ inputLabel: { shrink: true } }} sx={fieldSx} />
            <Typography sx={{ color: 'grey.300' }}>{timezone === null ? t('taskEditor.loading') : t('taskEditor.timezone', { timezone })}</Typography>
            <Typography sx={{ fontWeight: 800 }}>{t('taskEditor.checklist')}</Typography>
            {checklist.map((item, index) => <Stack key={index} direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                <Checkbox checked={item.done} disabled={busy} slotProps={{ input: { 'aria-label': t('taskEditor.checked', { item: item.text }) } }}
                    onChange={event => setChecklist(items => items.map((value, i) => i === index ? { ...value, done: event.target.checked } : value))} />
                <TextField fullWidth label={t('taskEditor.item', { index: index + 1 })} value={item.text} disabled={busy} sx={fieldSx}
                    slotProps={{ htmlInput: { maxLength: 120 } }} onChange={event => setChecklist(items => items.map((value, i) => i === index ? { ...value, text: event.target.value } : value))} />
                <Button disabled={busy} aria-label={t('taskEditor.removeItem', { index: index + 1 })} onClick={() => setChecklist(items => items.filter((_, i) => i !== index))} sx={{ ...actionSx, minWidth: 40 }}>×</Button>
            </Stack>)}
            <Button disabled={busy || checklist.length >= 10} onClick={() => setChecklist(items => [...items, { text: '', done: false }])} sx={actionSx}>{t('taskEditor.addItem')}</Button>
        </Stack></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Button disabled={busy} onClick={onClose} sx={actionSx}>{t('taskEditor.cancel')}</Button>
            <Button disabled={busy || timezone === null || !title.trim() || checklist.some(item => !item.text.trim())} onClick={() => void save()} sx={actionSx}>{t(busy ? 'taskEditor.saving' : 'taskEditor.save')}</Button>
        </DialogActions>
    </Dialog>;
}
