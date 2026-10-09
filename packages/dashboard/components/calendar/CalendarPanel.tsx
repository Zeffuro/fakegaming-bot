"use client";

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { FeaturePanel } from '@/components/dashboard/FeaturePanel';
import { dashboardAccents, dashboardCardSx, dashboardFieldSx, ghostActionButtonSx } from '@/components/dashboard/dashboardTheme';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { userCalendarApi, type AvailableCalendar, type CalendarStatus } from '@/lib/api/userCalendar';
import { CalendarPublishingDialog } from './CalendarPublishingDialog';
import { CalendarPublishingList } from './CalendarPublishingList';

export function CalendarPanel() {
    const { t, formatDate } = useDashboardI18n();
    const [status, setStatus] = useState<CalendarStatus | null>(null);
    const [calendars, setCalendars] = useState<AvailableCalendar[]>([]);
    const [selected, setSelected] = useState('');
    const [filter, setFilter] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [publishingSourceId, setPublishingSourceId] = useState<string | null>(null);
    const [publishingRevision, setPublishingRevision] = useState(0);
    const load = useCallback(async () => {
        const next = await userCalendarApi.status();
        setStatus(next);
        if (next.configured && next.connected) setCalendars((await userCalendarApi.calendars()).calendars);
        else setCalendars([]);
    }, []);
    useEffect(() => { void load().catch(() => setError(t('calendar.connectionError'))); }, [load, t]);
    async function run(action: () => Promise<void>) {
        setBusy(true); setError(null); setPending(false);
        try { await action(); await load(); } catch (err) { setError(err instanceof Error ? err.message : t('calendar.connectionError')); }
        finally { setBusy(false); }
    }
    const oauthResult = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('googleCalendar') : null;
    return <FeaturePanel accent={dashboardAccents.commands}>
        <Stack spacing={2.25} sx={{ position: 'relative', minWidth: 0 }}>
            <Typography variant="h5" sx={{ color: 'grey.50', fontWeight: 900 }}>{t('calendar.title')}</Typography>
            <Typography sx={{ color: 'grey.300' }}>{t('calendar.description')}</Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {oauthResult === 'error' && <Alert severity="error">{t('calendar.connectionError')}</Alert>}
            {oauthResult === 'success' && <Alert severity="success">{t('calendar.connected')}</Alert>}
            {status && !status.configured && <Alert severity="info"><Typography>{t('calendar.notConfigured')}</Typography><Typography component="div" variant="body2" sx={{ overflowWrap: 'anywhere', mt: 1 }}>{t('calendar.setup')}</Typography></Alert>}
            {status?.configured && <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                <Button disabled={busy} onClick={() => void run(async () => { const result = await userCalendarApi.connect(); window.location.assign(result.url); })} sx={ghostActionButtonSx(dashboardAccents.commands)}>{t(status.connected ? 'calendar.reconnect' : 'calendar.connect')}</Button>
                {status.connected && <Button disabled={busy} onClick={() => void run(async () => { await userCalendarApi.disconnect(); })} sx={ghostActionButtonSx(dashboardAccents.quotes)}>{t('calendar.disconnect')}</Button>}
                <Button disabled={busy} onClick={() => void run(async () => undefined)} sx={ghostActionButtonSx(dashboardAccents.commands)}>{t('calendar.refresh')}</Button>
            </Stack>}
            {status?.connected && <Stack spacing={1.5}>
                <TextField select label={t('calendar.calendar')} value={selected} onChange={event => setSelected(event.target.value)} size="small" sx={dashboardFieldSx(dashboardAccents.commands)}>
                    <MenuItem value="">{t('calendar.choose')}</MenuItem>
                    {calendars.map(calendar => <MenuItem key={calendar.id} value={calendar.id} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{calendar.summary}</MenuItem>)}
                </TextField>
                <TextField label={t('calendar.filter')} helperText={t('calendar.filterHelp')} value={filter} onChange={event => setFilter(event.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} size="small" sx={dashboardFieldSx(dashboardAccents.commands)} />
                <Button disabled={busy || !selected || status.sources.filter(source => source.enabled).length >= 10} onClick={() => void run(async () => { const result = await userCalendarApi.select(selected, filter.trim()); setPending(result.syncPending); setSelected(''); setFilter(''); })} sx={ghostActionButtonSx(dashboardAccents.commands)}>{t('calendar.select')}</Button>
            </Stack>}
            {pending && <Alert severity="info">{t('calendar.syncPending')}</Alert>}
            {status?.sources.length === 0 && <Typography sx={{ color: 'grey.300' }}>{t('calendar.empty')}</Typography>}
            {status?.sources.map(source => <Box key={source.id} sx={{ ...dashboardCardSx(dashboardAccents.commands), p: 2 }}>
                <Stack spacing={1} sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: 'grey.50', fontWeight: 800, overflowWrap: 'anywhere' }}>{source.label}</Typography>
                    <Typography sx={{ color: 'grey.300', overflowWrap: 'anywhere' }}>{source.titleFilter ? t('calendar.selectedFilter', { filter: source.titleFilter }) : t('calendar.allEvents')}</Typography>
                    <Typography variant="body2" sx={{ color: 'grey.400' }}>{source.enabled ? t('calendar.active') : t('calendar.inactive')} · {source.timezone}</Typography>
                    <Typography variant="body2" sx={{ color: 'grey.400' }}>{source.lastSyncedAt ? t('calendar.lastSync', { date: formatDate(Number(source.lastSyncedAt)) }) : t('calendar.neverSynced')}</Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                        <Button disabled={busy || !status.connected || !source.enabled} onClick={() => void run(async () => { await userCalendarApi.sync(source.id); })} sx={ghostActionButtonSx(dashboardAccents.commands)}>{t('calendar.sync')}</Button>
                        <Button disabled={busy || !status.connected || source.enabled || status.sources.filter(item => item.enabled).length >= 10} onClick={() => void run(async () => { const result = await userCalendarApi.select(source.calendarId, source.titleFilter ?? ''); setPending(result.syncPending); })} sx={ghostActionButtonSx(dashboardAccents.commands)}>{t('calendar.resume')}</Button>
                        <Button disabled={busy} onClick={() => void run(async () => { await userCalendarApi.remove(source.id); })} sx={ghostActionButtonSx(dashboardAccents.quotes)}>{t('calendar.remove')}</Button>
                        {source.enabled && status.connected && <Button disabled={busy} onClick={() => setPublishingSourceId(source.id)} sx={ghostActionButtonSx(dashboardAccents.commands)}>{t('calendar.publishing.open')}</Button>}
                    </Stack>
                </Stack>
            </Box>)}
            <Typography variant="body2" sx={{ color: 'grey.400' }}>{t('calendar.historyHelp')}</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                {(['json', 'csv'] as const).map(format => <Button key={format} disabled={busy} onClick={() => void run(async () => {
                    const blob = await userCalendarApi.export(format);
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a'); link.href = url; link.download = `schedule-history.${format}`;
                    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            })} sx={ghostActionButtonSx(dashboardAccents.commands)}>{t('calendar.export', { format: format.toUpperCase() })}</Button>)}
            </Stack>
            <CalendarPublishingList revision={publishingRevision} />
            {status?.connected && status.sources.filter(source => source.id === publishingSourceId && source.enabled).map(source =>
                <CalendarPublishingDialog key={source.id} source={source} onClose={() => setPublishingSourceId(null)} onPublished={() => setPublishingRevision(value => value + 1)} />)}
        </Stack>
    </FeaturePanel>;
}
