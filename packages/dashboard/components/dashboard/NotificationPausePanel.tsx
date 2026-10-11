"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { Alert, Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import { notificationPauseApi, type PersonalNotificationPausePreferences } from '@/lib/api/notificationPause';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { FeaturePanel } from './FeaturePanel';
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx } from './dashboardTheme';

function localResume(timestamp: number | null, timezone: string): string {
    if (timestamp === null) return '';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(timestamp);
    const part = (type: string) => parts.find(value => value.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
export function NotificationPausePanel({ revision, compact = false }: { revision?: string; compact?: boolean }) {
    const { t, formatDate } = useDashboardI18n();
    const [settings, setSettings] = useState<PersonalNotificationPausePreferences | null>(null);
    const [enabled, setEnabled] = useState(false); const [resumeAt, setResumeAt] = useState('');
    const [busy, setBusy] = useState(true); const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const settingsId = useId();
    const pending = useRef(false); const sequence = useRef(0);
    function apply(value: PersonalNotificationPausePreferences) {
        const effective = value.enabled && value.resumeAt !== null && value.resumeAt <= Date.now()
            ? { ...value, enabled: false, resumeAt: null } : value;
        setSettings(effective); setEnabled(effective.enabled); setResumeAt(localResume(effective.resumeAt, effective.timezone));
    }
    useEffect(() => {
        const current = ++sequence.current; setBusy(true); setError(null); setSaved(false);
        void notificationPauseApi.get().then(value => { if (current === sequence.current) apply(value); })
            .catch(err => { if (current === sequence.current) setError(err instanceof Error ? err.message : t('notificationPause.failed')); })
            .finally(() => { if (current === sequence.current) setBusy(false); });
        return () => { sequence.current++; };
    }, [revision]);
    useEffect(() => {
        if (!settings?.enabled || settings.resumeAt === null) return;
        let timer: ReturnType<typeof setTimeout>;
        const check = () => {
            const remaining = settings.resumeAt! - Date.now();
            if (remaining <= 0) {
                if (pending.current) timer = setTimeout(check, 1000); else void run('reload');
                return;
            }
            timer = setTimeout(check, Math.min(remaining, 2147483647));
        };
        check(); return () => clearTimeout(timer);
    }, [settings?.enabled, settings?.resumeAt]);
    async function run(action: 'save' | 'resume' | 'reload') {
        if (pending.current || (action !== 'reload' && !settings)) return;
        pending.current = true; const current = ++sequence.current; setBusy(true); setError(null); setSaved(false);
        try {
            const value = action === 'reload' ? await notificationPauseApi.get() : await notificationPauseApi.save({
                enabled: action === 'resume' ? false : enabled, resumeAt: action === 'resume' || !enabled || !resumeAt ? null : resumeAt,
                timezone: settings!.timezone, version: settings!.version,
            });
            if (current === sequence.current) { apply(value); setSaved(action !== 'reload'); }
        } catch (err) { if (current === sequence.current) setError(err instanceof Error ? err.message : t('notificationPause.failed')); }
        finally { pending.current = false; if (current === sequence.current) setBusy(false); }
    }
    const disabled = busy || !settings; const buttonSx = ghostActionButtonSx(dashboardAccents.settings);
    return <FeaturePanel accent={dashboardAccents.settings} sx={compact ? { p: 2 } : undefined}><Stack spacing={2} sx={{ position: 'relative', minWidth: 0 }}>
        {!compact && <Typography variant="h6" sx={{ color: 'grey.50', fontWeight: 900 }}>{t('notificationPause.title')}</Typography>}
        {error && <Alert severity="error">{error}</Alert>}
        {saved && <Alert severity="success">{t('notificationPause.saved')}</Alert>}
        {busy && <Typography role="status" sx={{ color: 'grey.300' }}>{t('notificationPause.loading')}</Typography>}
        <Stack direction={{ xs: 'column', sm: compact ? 'row' : 'column' }} sx={{ gap: 1, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: compact ? 'center' : 'stretch' } }}>
            {settings && <Typography role="status" sx={{ color: 'grey.100', overflowWrap: 'anywhere' }}>
                {settings.enabled ? settings.resumeAt === null ? t(compact ? 'notificationPause.compactPaused' : 'notificationPause.pausedIndefinitely')
                    : t(compact ? 'notificationPause.compactPausedUntil' : 'notificationPause.pausedUntil', { date: formatDate(settings.resumeAt, { dateStyle: 'medium', timeStyle: 'short', timeZone: settings.timezone }) })
                    : t(compact ? 'notificationPause.compactActive' : 'notificationPause.active')}
            </Typography>}
            {compact && <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button aria-expanded={expanded} aria-controls={expanded ? settingsId : undefined} onClick={() => setExpanded(value => !value)} sx={buttonSx}>{t('notificationPause.settings')}</Button>
                {settings?.enabled && <Button disabled={disabled} onClick={() => void run('resume')} sx={buttonSx}>{t('notificationPause.resume')}</Button>}
                {error && !expanded && <Button disabled={busy} onClick={() => void run('reload')} sx={buttonSx}>{t('notificationPause.reload')}</Button>}
            </Stack>}
        </Stack>
        {(!compact || expanded) && <Stack spacing={2} id={compact ? settingsId : undefined}>
            <Typography sx={{ color: 'grey.300', overflowWrap: 'anywhere' }}>{t('notificationPause.description')}</Typography>
            <FormControlLabel sx={{ color: 'grey.100' }} label={t('notificationPause.enabled')} control={<Switch checked={enabled} disabled={disabled}
                onChange={(_, value) => { setEnabled(value); setSaved(false); if (!value) setResumeAt(''); }} />} />
            <TextField type="datetime-local" label={t('notificationPause.resumeAt')} value={resumeAt} disabled={disabled || !enabled}
                onChange={event => { setResumeAt(event.target.value); setSaved(false); }} slotProps={{ inputLabel: { shrink: true } }}
                helperText={t('notificationPause.timezone', { timezone: settings?.timezone ?? 'UTC' })}
                sx={{ ...dashboardFieldSx(dashboardAccents.settings), '& input': { colorScheme: 'dark' } }} />
            <Typography sx={{ color: 'grey.400', overflowWrap: 'anywhere' }}>{t('notificationPause.behavior')}</Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button disabled={disabled} onClick={() => void run('save')} sx={buttonSx}>{t('notificationPause.save')}</Button>
                {!compact && <Button disabled={disabled || !settings?.enabled} onClick={() => void run('resume')} sx={buttonSx}>{t('notificationPause.resume')}</Button>}
                <Button disabled={busy} onClick={() => void run('reload')} sx={buttonSx}>{t('notificationPause.reload')}</Button>
            </Stack>
        </Stack>}
    </Stack></FeaturePanel>;
}
