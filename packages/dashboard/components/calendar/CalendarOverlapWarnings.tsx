"use client";

import { useEffect, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { calendarOverlapsApi, type CalendarOverlapPage, type OverlapEvent } from '@/lib/api/calendarOverlaps';
import { dashboardAccents, dashboardCardSx, ghostActionButtonSx } from '@/components/dashboard/dashboardTheme';

const PAGE_SIZE = 10;

export function CalendarOverlapWarnings({ revision }: { revision: number }) {
    const { t, formatDate } = useDashboardI18n();
    const [page, setPage] = useState<CalendarOverlapPage | null>(null);
    const [offset, setOffset] = useState(0);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);
    useEffect(() => { setOffset(0); }, [revision]);
    useEffect(() => {
        let active = true;
        setLoading(true); setError(false);
        void calendarOverlapsApi.list(offset, PAGE_SIZE).then(result => {
            if (!active) return;
            if (offset > 0 && offset >= result.total) { setOffset(0); return; }
            setPage(result);
        }).catch(() => { if (active) { setPage(null); setError(true); } })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [revision, offset, retry]);
    const date = (at: number, timezone: string) => {
        try { return formatDate(at, { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }); }
        catch { return formatDate(at, { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }); }
    };
    const event = (item: OverlapEvent) => <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{item.title}</Typography>
        <Typography variant="body2" sx={{ color: 'grey.300', overflowWrap: 'anywhere' }}>{item.sourceLabel}</Typography>
        <Typography variant="body2" sx={{ color: 'grey.400', overflowWrap: 'anywhere' }}>{t('calendarOverlaps.eventTime', {
            start: date(item.startAt, item.timezone), end: date(item.endAt, item.timezone), timezone: item.timezone,
        })}</Typography>
    </Stack>;
    return <Stack spacing={1.5} sx={{ minWidth: 0 }}>
        <Typography variant="h6">{t('calendarOverlaps.title')}</Typography>
        <Box component="details" sx={{ color: 'grey.400' }}>
            <Box component="summary" sx={{ cursor: 'pointer' }}>{t('calendar.overlapDetails')}</Box>
            <Typography variant="body2" sx={{ mt: 1 }}>{t('calendarOverlaps.help')}</Typography>
            {page?.connected && page.sources.map(source => <Typography key={source.id} variant="body2" sx={{ overflowWrap: 'anywhere' }}>{source.lastSyncedAt === null
                ? t('calendarOverlaps.pendingSource', { source: source.label })
                : t('calendarOverlaps.sourceSync', { source: source.label, date: formatDate(source.lastSyncedAt) })}</Typography>)}
        </Box>
        {loading && <Typography role="status">{t('calendarOverlaps.loading')}</Typography>}
        {error && <Alert severity="error" action={<Button onClick={() => setRetry(value => value + 1)}>{t('calendarOverlaps.retry')}</Button>}>{t('calendarOverlaps.failed')}</Alert>}
        {!loading && page && <>
            {!page.connected && <Typography>{t('calendarOverlaps.disconnected')}</Typography>}
            {page.connected && <>
                {page.sources.length === 0 && <Typography>{t('calendarOverlaps.noSources')}</Typography>}
                {page.sources.length > 0 && <Typography>{t(page.total > 0 ? 'calendarOverlaps.count' : 'calendarOverlaps.empty', { count: page.total })}</Typography>}
                {page.overlaps.map(pair => <Box key={`${pair.first.id}:${pair.second.id}`} sx={{ ...dashboardCardSx(dashboardAccents.commands), p: 2 }}>
                    <Stack spacing={1.5}>{event(pair.first)}{event(pair.second)}</Stack>
                </Box>)}
                {page.total > PAGE_SIZE && <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    <Button disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))} sx={ghostActionButtonSx(dashboardAccents.commands)}>{t('calendarOverlaps.previous')}</Button>
                    <Typography sx={{ alignSelf: 'center' }}>{t('calendarOverlaps.page', { page: Math.floor(offset / PAGE_SIZE) + 1, pages: Math.ceil(page.total / PAGE_SIZE) })}</Typography>
                    <Button disabled={offset + PAGE_SIZE >= page.total} onClick={() => setOffset(value => value + PAGE_SIZE)} sx={ghostActionButtonSx(dashboardAccents.commands)}>{t('calendarOverlaps.next')}</Button>
                </Stack>}
            </>}
        </>}
    </Stack>;
}
