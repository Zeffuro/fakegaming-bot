"use client";

import { useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { useDashboardData } from '@/components/hooks/useDashboardData';
import { useGuildChannels } from '@/components/hooks/useGuildChannels';
import { calendarPublishingApi, type CalendarPublicationPreview } from '@/lib/api/calendarPublishing';
import { dashboardAccents, dashboardDialogPaperSx, dashboardFieldSx, ghostActionButtonSx, primaryActionButtonSx } from '@/components/dashboard/dashboardTheme';
import { DiscordChannelPicker } from '@/components/config-dialog/DiscordChannelPicker';
import type { CalendarSource } from '@/lib/api/userCalendar';

const accent = dashboardAccents.commands;
const selectSlots = { inputLabel: { shrink: true }, select: { displayEmpty: true, MenuProps: {
    slotProps: { paper: { sx: { bgcolor: '#111923', backgroundImage: 'none', color: 'grey.100', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 2,
        '& .MuiMenuItem-root': { whiteSpace: 'normal', overflowWrap: 'anywhere', '&.Mui-selected': { bgcolor: 'rgba(104,215,255,0.12)' } } } } },
} } };

function ChannelField({ guildId, value, disabled, onChange }: { guildId: string; value: string; disabled: boolean; onChange: (id: string) => void }) {
    const { t } = useDashboardI18n();
    const { channels, loading, error } = useGuildChannels(guildId, { enabled: Boolean(guildId) });
    return <>
        {error && <Alert severity="error">{t('calendar.publishing.channelsFailed')}</Alert>}
        <DiscordChannelPicker channels={channels.filter(channel => channel.type === 0 || channel.type === 5)} value={value}
            disabled={disabled || !guildId} loading={loading} onChange={onChange} accent={accent}
            label={t('calendar.publishing.channel')} placeholder={t('calendar.publishing.chooseChannel')} />
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
    const [includeEventDetails, setIncludeEventDetails] = useState(false);
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
                eventLeadDays: serverEvents ? eventLeadDays : null, publicTitle: publicTitle.trim() || null, includeEventDetails }));
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
    return <Dialog open onClose={() => { if (!busy) onClose(); }} fullWidth maxWidth="sm"
        slotProps={{ paper: { sx: { ...dashboardDialogPaperSx(accent), backgroundImage: 'none', color: 'grey.100', colorScheme: 'dark',
            '& .MuiCheckbox-root.Mui-checked': { color: accent } } } }}>
        <DialogTitle sx={{ fontWeight: 850 }}>{t('calendar.publishing.title')}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1, minWidth: 0, '& > .MuiTypography-body2': { color: 'grey.300' } }}>
            <Typography sx={{ overflowWrap: 'anywhere' }}>{source.label}</Typography>
            <Alert severity="warning">{t('calendar.publishing.warning')}</Alert>
            <Typography variant="body2">{t('calendar.publishing.privateHelp')}</Typography>
            <Typography variant="body2">{t('calendar.publishing.approvalHelp')}</Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {guildError && <Alert severity="error">{t('calendar.publishing.guildsFailed')}</Alert>}
            <TextField select slotProps={selectSlots} label={t('calendar.publishing.guild')} value={guildId} disabled={busy || loading}
                onChange={event => { invalidate(); setGuildId(event.target.value); setChannelId(''); }} sx={dashboardFieldSx(dashboardAccents.commands)}>
                <MenuItem value="">{t('calendar.publishing.chooseGuild')}</MenuItem>
                {guilds.map(guild => <MenuItem key={guild.id} value={guild.id}>{guild.name}</MenuItem>)}
            </TextField>
            <ChannelField key={guildId} guildId={guildId} value={channelId} disabled={busy} onChange={id => { invalidate(); setChannelId(id); }} />
            <TextField select slotProps={selectSlots} label={t('calendar.publishing.lookahead')} value={lookaheadDays} disabled={busy}
                onChange={event => { invalidate(); setLookaheadDays(Number(event.target.value)); }} sx={dashboardFieldSx(dashboardAccents.commands)}>
                {[30, 90, 180, 365].map(days => <MenuItem key={days} value={days}>{t('calendar.publishing.days', { days })}</MenuItem>)}
            </TextField>
            <TextField label={t('calendar.publishing.override')} helperText={t('calendar.publishing.overrideHelp')} value={publicTitle} disabled={busy}
                slotProps={{ htmlInput: { maxLength: 100 } }} onChange={event => { invalidate(); setPublicTitle(event.target.value); }} sx={dashboardFieldSx(dashboardAccents.commands)} />
            <FormControlLabel control={<Checkbox checked={serverEvents} disabled={busy} onChange={event => { invalidate(); setServerEvents(event.target.checked); }} />} label={t('calendar.publishing.createEvents')} />
            <FormControlLabel control={<Checkbox checked={includeEventDetails} disabled={busy} onChange={event => { invalidate(); setIncludeEventDetails(event.target.checked); }} />} label={t('calendar.publishing.includeEventDetails')} />
            <Typography variant="body2">{t('calendar.publishing.eventDetailsHelp')}</Typography>
            {serverEvents && <>
                <Alert severity="warning">{t('calendar.publishing.serverWarning')}</Alert>
                <Typography variant="body2">{t('calendar.publishing.eventDurationHelp')}</Typography>
                <TextField select slotProps={selectSlots} label={t('calendar.publishing.eventLeadLabel')} value={eventLeadDays} disabled={busy}
                    onChange={event => { invalidate(); setEventLeadDays(Number(event.target.value)); }} sx={dashboardFieldSx(dashboardAccents.commands)}>
                    {[1, 7, 14, 30].map(days => <MenuItem key={days} value={days}>{t('calendar.publishing.days', { days })}</MenuItem>)}
                </TextField>
            </>}
            <Button variant="outlined" sx={ghostActionButtonSx(accent)} disabled={busy || !guildId || !channelId} onClick={() => void createPreview()}>{t('calendar.publishing.preview')}</Button>
            {preview && <Stack spacing={1.5} sx={{ overflowWrap: 'anywhere' }}>
                <Typography variant="h6">{t('calendar.publishing.destination', { guild: preview.guildName, channel: preview.channelName })}</Typography>
                <Typography>{t('calendar.publishing.count', { count: preview.count, eventCount: preview.eventCount })}</Typography>
                <Typography variant="body2">{t('calendar.publishing.expires', { date: formatDate(preview.expiresAt) })}</Typography>
                {preview.publicTitle && <Typography>{t('calendar.publishing.overridePreview', { title: preview.publicTitle })}</Typography>}
                {preview.events.map((event, index) => <Box key={`${event.plannedAt}-${index}`} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{event.channelMessage?.title ?? preview.publicTitle ?? event.title}</Typography>
                    <Typography variant="body2">{formatDate(event.plannedAt, { timeZone: event.timezone, dateStyle: 'medium', timeStyle: 'short' })} ({event.timezone})</Typography>
                    {event.endAt !== null && <Typography variant="body2">{t('calendar.publishing.ends', { date: formatDate(event.endAt, { timeZone: event.timezone, dateStyle: 'medium', timeStyle: 'short' }) })}</Typography>}
                    {event.allDay && <Typography variant="body2">{t('calendar.publishing.allDay')}</Typography>}
                    {event.duration && <Typography variant="body2">{t('calendar.publishing.duration', { duration: event.duration })}</Typography>}
                    {event.channelMessage?.url && <Link href={event.channelMessage.url} target="_blank" rel="noopener noreferrer" sx={{ color: accent }}>{t('calendar.publishing.openEvent')}</Link>}
                    {event.channelMessage?.location && <Typography variant="body2">{t('calendar.publishing.location', { location: event.channelMessage.location })}</Typography>}
                    {event.channelMessage?.description && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{t('calendar.publishing.description', { description: event.channelMessage.description })}</Typography>}
                    {event.discordEvent && <Stack spacing={0.5} sx={{ mt: 1, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="subtitle2">{t('calendar.publishing.discordEventDetails')}</Typography>
                        <Typography variant="body2">{t('calendar.publishing.discordEventName', { name: event.discordEvent.name })}</Typography>
                        <Typography variant="body2">{t('calendar.publishing.discordEventStart', { date: formatDate(event.discordEvent.plannedAt, { timeZone: event.timezone, dateStyle: 'medium', timeStyle: 'short' }) })}</Typography>
                        <Typography variant="body2">{t('calendar.publishing.ends', { date: formatDate(event.discordEvent.endAt, { timeZone: event.timezone, dateStyle: 'medium', timeStyle: 'short' }) })}</Typography>
                        <Typography variant="body2">{t('calendar.publishing.discordEventLocation', { location: event.discordEvent.location })}</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{t('calendar.publishing.discordEventDescription', { description: event.discordEvent.description })}</Typography>
                    </Stack>}
                </Box>)}
                <FormControlLabel control={<Checkbox checked={acknowledgeChannel} disabled={busy} onChange={event => setAcknowledgeChannel(event.target.checked)} />} label={t(preview.includeEventDetails ? 'calendar.publishing.acknowledgeChannelDetails' : 'calendar.publishing.acknowledgeChannel')} />
                {preview.eventLeadDays !== null && <FormControlLabel control={<Checkbox checked={acknowledgeServerEvents} disabled={busy} onChange={event => setAcknowledgeServerEvents(event.target.checked)} />} label={t(preview.includeEventDetails ? 'calendar.publishing.acknowledgeEventsDetails' : 'calendar.publishing.acknowledgeEvents')} />}
                <TextField label={t('calendar.publishing.confirmName')} helperText={t('calendar.publishing.confirmNameHelp', { channel: preview.channelName })}
                    value={confirmChannelName} disabled={busy} onChange={event => setConfirmChannelName(event.target.value)} sx={dashboardFieldSx(dashboardAccents.commands)} />
            </Stack>}
        </Stack></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button sx={ghostActionButtonSx(accent)} disabled={busy} onClick={onClose}>{t('calendar.publishing.cancel')}</Button>
            <Button variant="contained" sx={{ ...primaryActionButtonSx(accent), color: '#07121b' }} disabled={busy || !canConfirm} onClick={() => void confirm()}>{t('calendar.publishing.enable')}</Button>
        </DialogActions>
    </Dialog>;
}
