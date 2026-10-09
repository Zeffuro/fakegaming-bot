"use client";

import { useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { useDashboardData } from '@/components/hooks/useDashboardData';
import { useGuildChannels } from '@/components/hooks/useGuildChannels';
import { calendarPublishingApi, type CalendarPublicationPreview } from '@/lib/api/calendarPublishing';
import { dashboardAccents, dashboardFieldSx } from '@/components/dashboard/dashboardTheme';
import type { CalendarSource } from '@/lib/api/userCalendar';

function ChannelField({ guildId, value, disabled, onChange }: { guildId: string; value: string; disabled: boolean; onChange: (id: string) => void }) {
    const { t } = useDashboardI18n();
    const { channels, loading, error } = useGuildChannels(guildId, { enabled: Boolean(guildId) });
    return <>
        {error && <Alert severity="error">{t('calendar.publishing.channelsFailed')}</Alert>}
        <TextField select slotProps={{ select: { native: true } }} label={t('calendar.publishing.channel')} value={value}
            disabled={disabled || !guildId || loading} onChange={event => onChange(event.target.value)} sx={dashboardFieldSx(dashboardAccents.commands)}>
            <option value="">{t('calendar.publishing.chooseChannel')}</option>
            {channels.filter(channel => channel.type === 0 || channel.type === 5).map(channel => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
        </TextField>
    </>;
}

export function CalendarPublishingDialog({ source, onClose, onPublished }: { source: CalendarSource; onClose: () => void; onPublished: () => void }) {
    const { t, formatDate } = useDashboardI18n();
    const { guilds, loading, error: guildError } = useDashboardData();
    const [guildId, setGuildId] = useState('');
    const [channelId, setChannelId] = useState('');
    const [lookaheadDays, setLookaheadDays] = useState(180);
    const [serverEvents, setServerEvents] = useState(false);
    const [eventLeadDays, setEventLeadDays] = useState(7);
    const [publicTitle, setPublicTitle] = useState('');
    const [preview, setPreview] = useState<CalendarPublicationPreview | null>(null);
    const [acknowledgeChannel, setAcknowledgeChannel] = useState(false);
    const [acknowledgeServerEvents, setAcknowledgeServerEvents] = useState(false);
    const [confirmChannelName, setConfirmChannelName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    function invalidate() {
        setPreview(null); setAcknowledgeChannel(false); setAcknowledgeServerEvents(false); setConfirmChannelName(''); setError(null);
    }
    async function createPreview() {
        invalidate(); setBusy(true);
        try {
            setPreview(await calendarPublishingApi.preview({ sourceId: source.id, guildId, channelId, lookaheadDays,
                eventLeadDays: serverEvents ? eventLeadDays : null, publicTitle: publicTitle.trim() || null }));
        } catch (cause) { setError(cause instanceof Error ? cause.message : t('calendar.publishing.previewFailed')); }
        finally { setBusy(false); }
    }
    const canConfirm = Boolean(preview && acknowledgeChannel && (preview.eventLeadDays === null || acknowledgeServerEvents)
        && confirmChannelName === preview.channelName && preview.expiresAt > Date.now());
    async function confirm() {
        if (!canConfirm || !preview) return;
        if (preview.expiresAt <= Date.now()) { invalidate(); setError(t('calendar.publishing.confirmFailed')); return; }
        setBusy(true); setError(null);
        try {
            await calendarPublishingApi.confirm({ draftId: preview.draftId, acknowledgeChannel: true,
                acknowledgeServerEvents: preview.eventLeadDays !== null && acknowledgeServerEvents, confirmChannelName });
            onPublished(); onClose();
        } catch (cause) { invalidate(); setError(cause instanceof Error ? cause.message : t('calendar.publishing.confirmFailed')); }
        finally { setBusy(false); }
    }
    return <Dialog open onClose={() => { if (!busy) onClose(); }} fullWidth maxWidth="sm">
        <DialogTitle>{t('calendar.publishing.title')}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1, minWidth: 0 }}>
            <Typography sx={{ overflowWrap: 'anywhere' }}>{source.label}</Typography>
            <Alert severity="warning">{t('calendar.publishing.warning')}</Alert>
            <Typography variant="body2">{t('calendar.publishing.privateHelp')}</Typography>
            <Typography variant="body2">{t('calendar.publishing.approvalHelp')}</Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {guildError && <Alert severity="error">{t('calendar.publishing.guildsFailed')}</Alert>}
            <TextField select slotProps={{ select: { native: true } }} label={t('calendar.publishing.guild')} value={guildId} disabled={busy || loading}
                onChange={event => { invalidate(); setGuildId(event.target.value); setChannelId(''); }} sx={dashboardFieldSx(dashboardAccents.commands)}>
                <option value="">{t('calendar.publishing.chooseGuild')}</option>
                {guilds.map(guild => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
            </TextField>
            <ChannelField key={guildId} guildId={guildId} value={channelId} disabled={busy} onChange={id => { invalidate(); setChannelId(id); }} />
            <TextField select slotProps={{ select: { native: true } }} label={t('calendar.publishing.lookahead')} value={lookaheadDays} disabled={busy}
                onChange={event => { invalidate(); setLookaheadDays(Number(event.target.value)); }} sx={dashboardFieldSx(dashboardAccents.commands)}>
                {[30, 90, 180, 365].map(days => <option key={days} value={days}>{t('calendar.publishing.days', { days })}</option>)}
            </TextField>
            <TextField label={t('calendar.publishing.override')} helperText={t('calendar.publishing.overrideHelp')} value={publicTitle} disabled={busy}
                slotProps={{ htmlInput: { maxLength: 100 } }} onChange={event => { invalidate(); setPublicTitle(event.target.value); }} sx={dashboardFieldSx(dashboardAccents.commands)} />
            <FormControlLabel control={<Checkbox checked={serverEvents} disabled={busy} onChange={event => { invalidate(); setServerEvents(event.target.checked); }} />} label={t('calendar.publishing.createEvents')} />
            {serverEvents && <>
                <Alert severity="warning">{t('calendar.publishing.serverWarning')}</Alert>
                <Typography variant="body2">{t('calendar.publishing.eventDurationHelp')}</Typography>
                <TextField select slotProps={{ select: { native: true } }} label={t('calendar.publishing.eventLeadLabel')} value={eventLeadDays} disabled={busy}
                    onChange={event => { invalidate(); setEventLeadDays(Number(event.target.value)); }} sx={dashboardFieldSx(dashboardAccents.commands)}>
                    {[1, 7, 14, 30].map(days => <option key={days} value={days}>{t('calendar.publishing.days', { days })}</option>)}
                </TextField>
            </>}
            <Button disabled={busy || !guildId || !channelId} onClick={() => void createPreview()}>{t('calendar.publishing.preview')}</Button>
            {preview && <Stack spacing={1.5} sx={{ overflowWrap: 'anywhere' }}>
                <Typography variant="h6">{t('calendar.publishing.destination', { guild: preview.guildName, channel: preview.channelName })}</Typography>
                <Typography>{t('calendar.publishing.count', { count: preview.count, eventCount: preview.eventCount })}</Typography>
                <Typography variant="body2">{t('calendar.publishing.expires', { date: formatDate(preview.expiresAt) })}</Typography>
                {preview.publicTitle && <Typography>{t('calendar.publishing.overridePreview', { title: preview.publicTitle })}</Typography>}
                {preview.events.map((event, index) => <Box key={`${event.plannedAt}-${index}`} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{preview.publicTitle ?? event.title}</Typography>
                    <Typography variant="body2">{formatDate(event.plannedAt, { timeZone: event.timezone, dateStyle: 'medium', timeStyle: 'short' })} ({event.timezone})</Typography>
                    {event.endAt !== null && <Typography variant="body2">{t('calendar.publishing.ends', { date: formatDate(event.endAt, { timeZone: event.timezone, dateStyle: 'medium', timeStyle: 'short' }) })}</Typography>}
                    {event.allDay && <Typography variant="body2">{t('calendar.publishing.allDay')}</Typography>}
                    {event.discordEvent && <Stack spacing={0.5} sx={{ mt: 1, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="subtitle2">{t('calendar.publishing.discordEventDetails')}</Typography>
                        <Typography variant="body2">{t('calendar.publishing.discordEventName', { name: event.discordEvent.name })}</Typography>
                        <Typography variant="body2">{t('calendar.publishing.discordEventStart', { date: formatDate(event.discordEvent.plannedAt, { timeZone: event.timezone, dateStyle: 'medium', timeStyle: 'short' }) })}</Typography>
                        <Typography variant="body2">{t('calendar.publishing.ends', { date: formatDate(event.discordEvent.endAt, { timeZone: event.timezone, dateStyle: 'medium', timeStyle: 'short' }) })}</Typography>
                        <Typography variant="body2">{t('calendar.publishing.discordEventLocation', { location: event.discordEvent.location })}</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{t('calendar.publishing.discordEventDescription', { description: event.discordEvent.description })}</Typography>
                    </Stack>}
                </Box>)}
                <FormControlLabel control={<Checkbox checked={acknowledgeChannel} disabled={busy} onChange={event => setAcknowledgeChannel(event.target.checked)} />} label={t('calendar.publishing.acknowledgeChannel')} />
                {preview.eventLeadDays !== null && <FormControlLabel control={<Checkbox checked={acknowledgeServerEvents} disabled={busy} onChange={event => setAcknowledgeServerEvents(event.target.checked)} />} label={t('calendar.publishing.acknowledgeEvents')} />}
                <TextField label={t('calendar.publishing.confirmName')} helperText={t('calendar.publishing.confirmNameHelp', { channel: preview.channelName })}
                    value={confirmChannelName} disabled={busy} onChange={event => setConfirmChannelName(event.target.value)} sx={dashboardFieldSx(dashboardAccents.commands)} />
            </Stack>}
        </Stack></DialogContent>
        <DialogActions>
            <Button disabled={busy} onClick={onClose}>{t('calendar.publishing.cancel')}</Button>
            <Button disabled={busy || !canConfirm} onClick={() => void confirm()}>{t('calendar.publishing.enable')}</Button>
        </DialogActions>
    </Dialog>;
}
