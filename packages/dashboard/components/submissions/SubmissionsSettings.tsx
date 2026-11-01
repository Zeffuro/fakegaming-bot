"use client";

import { useState } from 'react';
import { Alert, Button, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import Add from '@mui/icons-material/Add';
import Refresh from '@mui/icons-material/Refresh';
import { FeaturePanel } from '@/components/dashboard/FeaturePanel';
import { dashboardAccents, ghostActionButtonSx, primaryActionButtonSx } from '@/components/dashboard/dashboardTheme';
import { useSubmissions } from '@/components/hooks/useSubmissions';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import type { SubmissionCategory } from '@/lib/api/submissions';
import { SubmissionCategoryDialog } from './SubmissionCategoryDialog';

const accent = dashboardAccents.commands;

export function SubmissionsSettings({ guildId }: { guildId: string }) {
    const { t } = useDashboardI18n();
    const data = useSubmissions(guildId, true);
    const [dialog, setDialog] = useState<{ category?: SubmissionCategory } | null>(null);
    const channelName = (id: string) => {
        const channel = data.options.channels.find(value => value.id === id);
        return channel ? `#${channel.name}` : id;
    };

    return <Stack spacing={3}>
        <FeaturePanel accent={accent} sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={1.5}>
                <Typography variant="h6" sx={{ color: 'grey.100', fontWeight: 850 }}>{t('submissions.setupTitle')}</Typography>
                <Typography sx={{ color: 'grey.300' }}>{t('submissions.setup')}</Typography>
                <Typography component="code" sx={{ color: accent, overflowWrap: 'anywhere' }}>/submissions panel channel:&lt;channel&gt;</Typography>
                <Alert severity="warning">{t('submissions.privacy')}</Alert>
                <Typography variant="body2" sx={{ color: 'grey.400' }}>{t('submissions.discordOnly')}</Typography>
            </Stack>
        </FeaturePanel>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
            <Typography variant="h5" sx={{ flexGrow: 1, color: 'grey.100', fontWeight: 850 }}>{t('submissions.categories', { count: data.categories.length })}</Typography>
            <Button startIcon={<Refresh />} disabled={data.loading || dialog !== null} sx={ghostActionButtonSx(accent)} onClick={() => void data.refresh()}>{t('submissions.refresh')}</Button>
            <Button startIcon={<Add />} disabled={!data.ready || data.loading || data.categories.length >= 25} sx={primaryActionButtonSx(accent)} onClick={() => setDialog({})}>{t('submissions.add')}</Button>
        </Stack>
        {data.loading && <LinearProgress aria-label={t('submissions.loading')} />}
        {data.error && <Alert severity="error">{data.error}</Alert>}
        {!data.loading && data.ready && data.categories.length === 0 && <Typography sx={{ color: 'grey.300' }}>{t('submissions.empty')}</Typography>}
        {data.categories.length >= 25 && <Alert severity="info">{t('submissions.limit')}</Alert>}
        {data.categories.map(category => <FeaturePanel key={category.id} accent={accent} sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
                <Stack spacing={1} sx={{ minWidth: 0 }}>
                    <Typography variant="h6" sx={{ color: 'grey.100', overflowWrap: 'anywhere', fontWeight: 850 }}>{category.name}</Typography>
                    <Typography sx={{ color: 'grey.300', overflowWrap: 'anywhere' }}>{t('submissions.destinationValue', { channel: channelName(category.destinationChannelId) })}</Typography>
                    <Typography variant="body2" sx={{ color: 'grey.400', overflowWrap: 'anywhere' }}>{t('submissions.reviewValue', { channel: channelName(category.reviewChannelId) })}</Typography>
                    <Chip size="small" label={t(category.enabled ? 'submissions.active' : 'submissions.disabled')} sx={{ alignSelf: 'flex-start', color: 'grey.100', bgcolor: category.enabled ? 'rgba(104,215,255,0.15)' : 'rgba(255,255,255,0.08)' }} />
                </Stack>
                <Button disabled={!data.ready || data.loading} sx={ghostActionButtonSx(accent)} onClick={() => setDialog({ category })}>{t('submissions.edit')}</Button>
            </Stack>
        </FeaturePanel>)}
        {dialog && <SubmissionCategoryDialog guildId={guildId} category={dialog.category} options={data.options}
            onClose={() => setDialog(null)} onSaved={async () => { setDialog(null); await data.refresh(); }} />}
    </Stack>;
}
