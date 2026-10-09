"use client";

import { useEffect, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { calendarPublishingApi, type CalendarPublication } from '@/lib/api/calendarPublishing';
import { dashboardAccents, dashboardCardSx, ghostActionButtonSx } from '@/components/dashboard/dashboardTheme';

export function CalendarPublishingList({ revision }: { revision: number }) {
    const { t } = useDashboardI18n();
    const [publications, setPublications] = useState<CalendarPublication[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        let active = true;
        void calendarPublishingApi.list().then(result => { if (active) { setPublications(result.publications); setError(null); } })
            .catch(() => { if (active) setError(t('calendar.publishing.failed')); });
        return () => { active = false; };
    }, [revision, t]);
    async function stop(id: string) {
        setBusy(true); setError(null);
        try {
            await calendarPublishingApi.stop(id);
            setPublications(current => current.map(publication => publication.id === id ? { ...publication, enabled: false } : publication));
        } catch { setError(t('calendar.publishing.stopFailed')); }
        finally { setBusy(false); }
    }
    return <Stack spacing={1.5} sx={{ minWidth: 0 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {publications.length > 0 && <>
            <Typography variant="h6">{t('calendar.publishing.settings')}</Typography>
            <Typography variant="body2" sx={{ color: 'grey.400' }}>{t('calendar.publishing.stopHelp')}</Typography>
        </>}
        {publications.map(publication => <Box key={publication.id} sx={{ ...dashboardCardSx(dashboardAccents.commands), p: 2 }}>
            <Stack spacing={1} sx={{ overflowWrap: 'anywhere' }}>
                <Typography>{t('calendar.publishing.destination', { guild: publication.guildName, channel: publication.channelName })}</Typography>
                <Typography variant="body2">{t(publication.enabled ? 'calendar.publishing.enabled' : 'calendar.publishing.stopped')}</Typography>
                <Typography variant="body2">{t('calendar.publishing.days', { days: publication.lookaheadDays })}</Typography>
                {publication.eventLeadDays !== null && <Typography variant="body2">{t('calendar.publishing.eventLead', { days: publication.eventLeadDays })}</Typography>}
                {publication.publicTitle && <Typography variant="body2">{t('calendar.publishing.overridePreview', { title: publication.publicTitle })}</Typography>}
                {publication.includeEventDetails && <Typography variant="body2">{t('calendar.publishing.detailsEnabled')}</Typography>}
                {publication.lastError && <Alert severity="warning">{t('calendar.publishing.deliveryError')}</Alert>}
                {publication.uncertainCount > 0 && <Alert severity="warning">{t('calendar.publishing.uncertain', { count: publication.uncertainCount })}</Alert>}
                {publication.enabled && <Button disabled={busy} onClick={() => void stop(publication.id)} sx={ghostActionButtonSx(dashboardAccents.quotes)}>{t('calendar.publishing.stop')}</Button>}
            </Stack>
        </Box>)}
    </Stack>;
}
