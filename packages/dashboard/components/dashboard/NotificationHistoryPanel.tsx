"use client";

import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import { notificationHistoryApi, type NotificationHistoryKind, type NotificationHistoryStatus, type NotificationHistoryPage } from '@/lib/api/notificationHistory';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { FeaturePanel } from './FeaturePanel';
import { dashboardAccents, dashboardCardSx, dashboardFieldSx, ghostActionButtonSx } from './dashboardTheme';

const kinds: NotificationHistoryKind[] = ['reminder', 'follow', 'schedule', 'briefing', 'digest', 'anime'];
const statuses: NotificationHistoryStatus[] = ['pending', 'sent', 'delayed', 'skipped', 'failed', 'uncertain'];
const colors = { pending: 'default', sent: 'success', delayed: 'warning', skipped: 'default', failed: 'error', uncertain: 'warning' } as const;
const pageSize = 20;

export function NotificationHistoryPanel({ timezone = 'UTC' }: { timezone?: string }) {
    const { t, formatDate } = useDashboardI18n();
    const [kind, setKind] = useState<NotificationHistoryKind | 'all'>('all');
    const [status, setStatus] = useState<NotificationHistoryStatus | 'all'>('all');
    const [offset, setOffset] = useState(0);
    const [revision, setRevision] = useState(0);
    const [page, setPage] = useState<NotificationHistoryPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const sequence = useRef(0);
    useEffect(() => {
        const current = ++sequence.current;
        setPage(null); setLoading(true); setError(null);
        void notificationHistoryApi.list({ ...(kind === 'all' ? {} : { kind }), ...(status === 'all' ? {} : { status }), offset, limit: pageSize })
            .then(value => {
                if (current !== sequence.current) return;
                if (offset > 0 && offset >= value.total) setOffset(Math.max(0, Math.floor((value.total - 1) / pageSize) * pageSize));
                else setPage(value);
            })
            .catch(err => { if (current === sequence.current) setError(err instanceof Error ? err.message : t('notificationHistory.failed')); })
            .finally(() => { if (current === sequence.current) setLoading(false); });
        return () => { sequence.current++; };
    }, [kind, status, offset, revision, t]);
    const buttonSx = ghostActionButtonSx(dashboardAccents.settings);
    const date = (value: number) => formatDate(value, { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' });
    return <FeaturePanel accent={dashboardAccents.settings}><Stack spacing={2} sx={{ position: 'relative', minWidth: 0 }}>
        <Typography variant="h5" sx={{ color: 'grey.50', fontWeight: 900, fontSize: { xs: '1.125rem', sm: '1.5rem' }, overflowWrap: 'anywhere' }}>{t('notificationHistory.title')}</Typography>
        <Box component="details" sx={{ color: 'grey.400' }}>
            <Typography component="summary" sx={{ cursor: 'pointer', fontWeight: 700 }}>{t('dashboardLayout.help')}</Typography>
            <Typography sx={{ mt: 1, overflowWrap: 'anywhere' }}>{t('notificationHistory.description', { days: 90, count: 1000 })}</Typography>
            <Typography sx={{ mt: 1, overflowWrap: 'anywhere' }}>{t('notificationHistory.collection')}</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ minWidth: 0 }}>
            <TextField id="notification-history-kind" select label={t('notificationHistory.kindFilter')} value={kind}
                slotProps={{ select: { native: true } }} sx={{ ...dashboardFieldSx(dashboardAccents.settings), minWidth: { sm: 200 } }}
                onChange={event => { setKind(event.target.value as NotificationHistoryKind | 'all'); setOffset(0); }}>
                <option value="all">{t('notificationHistory.allKinds')}</option>
                {kinds.map(value => <option key={value} value={value}>{t(`notificationHistory.kinds.${value}`)}</option>)}
            </TextField>
            <TextField id="notification-history-status" select label={t('notificationHistory.statusFilter')} value={status}
                slotProps={{ select: { native: true } }} sx={{ ...dashboardFieldSx(dashboardAccents.settings), minWidth: { sm: 200 } }}
                onChange={event => { setStatus(event.target.value as NotificationHistoryStatus | 'all'); setOffset(0); }}>
                <option value="all">{t('notificationHistory.allStatuses')}</option>
                {statuses.map(value => <option key={value} value={value}>{t(`notificationHistory.statuses.${value}`)}</option>)}
            </TextField>
            <Button disabled={loading} onClick={() => setRevision(value => value + 1)} sx={buttonSx}>{t('notificationHistory.refresh')}</Button>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {loading && <Typography role="status" sx={{ color: 'grey.300' }}>{t('notificationHistory.loading')}</Typography>}
        {page && page.items.length === 0 && <Typography sx={{ color: 'grey.400' }}>{t('notificationHistory.empty')}</Typography>}
        {page?.items.map(item => <Box key={item.id} sx={{ ...dashboardCardSx(dashboardAccents.settings), p: 2, minWidth: 0 }}>
            <Stack spacing={1}>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                    <Typography sx={{ color: 'grey.50', fontWeight: 800, overflowWrap: 'anywhere', minWidth: 0 }}>{item.title || t(`notificationHistory.kinds.${item.kind}`)}</Typography>
                    <Chip size="small" color={colors[item.status]} label={t(`notificationHistory.statuses.${item.status}`)} />
                </Stack>
                <Typography sx={{ color: 'grey.400' }}>{t(`notificationHistory.kinds.${item.kind}`)}</Typography>
                {item.reason && <Typography sx={{ color: 'grey.300', overflowWrap: 'anywhere' }}>{t(`notificationHistory.reasons.${item.reason}`)}</Typography>}
                {item.status === 'uncertain' && <Typography sx={{ color: 'warning.light', overflowWrap: 'anywhere' }}>{t('notificationHistory.uncertainHelp')}</Typography>}
                <Typography sx={{ color: 'grey.400', overflowWrap: 'anywhere' }}>{t('notificationHistory.scheduledAt', { date: date(item.scheduledAt) })}</Typography>
                <Typography sx={{ color: 'grey.400', overflowWrap: 'anywhere' }}>{item.sentAt !== null
                    ? t('notificationHistory.sentAt', { date: date(item.sentAt) }) : t('notificationHistory.updatedAt', { date: date(item.updatedAt) })}</Typography>
                {item.messageUrl && <Button component="a" href={item.messageUrl} target="_blank" rel="noopener noreferrer" sx={{ ...buttonSx, alignSelf: 'flex-start' }}>{t('notificationHistory.openMessage')}</Button>}
            </Stack>
        </Box>)}
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Button disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - pageSize))} sx={buttonSx}>{t('notificationHistory.previous')}</Button>
            {page && <Typography sx={{ color: 'grey.300' }}>{t('notificationHistory.page', { page: Math.floor(offset / pageSize) + 1, pages: Math.max(1, Math.ceil(page.total / pageSize)) })}</Typography>}
            <Button disabled={loading || !page || offset + pageSize >= page.total} onClick={() => setOffset(value => value + pageSize)} sx={buttonSx}>{t('notificationHistory.next')}</Button>
        </Stack>
    </Stack></FeaturePanel>;
}
