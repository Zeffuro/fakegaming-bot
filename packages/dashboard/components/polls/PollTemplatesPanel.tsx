"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { FeaturePanel } from '@/components/dashboard/FeaturePanel';
import { dashboardAccents, dashboardCardSx, ghostActionButtonSx } from '@/components/dashboard/dashboardTheme';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { pollTemplatesApi, type PollTemplate } from '@/lib/api/pollTemplates';
import { PollTemplateDialog } from './PollTemplateDialog';

export function PollTemplatesPanel() {
    const { t } = useDashboardI18n();
    const [lists, setLists] = useState<PollTemplate[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [dialog, setDialog] = useState<{ template?: PollTemplate } | null>(null);
    const [removing, setRemoving] = useState<PollTemplate | null>(null);
    const pending = useRef(false);
    const sequence = useRef(0);
    const load = useCallback(async () => {
        const current = ++sequence.current; setLoading(true);
        try { const result = await pollTemplatesApi.list(); if (current === sequence.current) { setLists(result); setError(null); } }
        catch (err) { if (current === sequence.current) setError(err instanceof Error ? err.message : t('pollTemplates.failed')); }
        finally { if (current === sequence.current) setLoading(false); }
    }, [t]);
    useEffect(() => {
        void load(); const refresh = () => { if (!pending.current) void load(); };
        window.addEventListener('personal-polls-refresh', refresh);
        return () => { sequence.current++; window.removeEventListener('personal-polls-refresh', refresh); };
    }, [load]);
    async function remove(template: PollTemplate) {
        if (pending.current) return;
        pending.current = true; setBusy(true); setError(null); sequence.current++;
        try { await pollTemplatesApi.remove(template.id, template.version); setRemoving(null); await load(); }
        catch (err) { setError(err instanceof Error ? err.message : t('pollTemplates.failed')); }
        finally { pending.current = false; setBusy(false); }
    }
    const pages = Math.max(1, Math.ceil(lists.length / 5)); const current = Math.min(page, pages);
    const disabled = busy || loading;
    const buttonSx = ghostActionButtonSx(dashboardAccents.commands);
    return <FeaturePanel accent={dashboardAccents.commands}><Stack spacing={2} sx={{ position: 'relative', minWidth: 0 }}>
        <Typography variant="h5" sx={{ color: 'grey.50', fontWeight: 900 }}>{t('pollTemplates.title')}</Typography>
        <Typography sx={{ color: 'grey.300', overflowWrap: 'anywhere' }}>{t('pollTemplates.description')}</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Button disabled={disabled || lists.length >= 50} onClick={() => setDialog({})} sx={buttonSx}>{t('pollTemplates.create')}</Button>
            <Button disabled={disabled} onClick={() => void load()} sx={buttonSx}>{t('pollTemplates.refresh')}</Button>
        </Stack>
        {loading && <Typography sx={{ color: 'grey.300' }}>{t('pollTemplates.loading')}</Typography>}
        {!loading && lists.length === 0 && <Typography sx={{ color: 'grey.400' }}>{t('pollTemplates.empty')}</Typography>}
        {lists.slice((current - 1) * 5, current * 5).map(template => <Box key={template.id} sx={{ ...dashboardCardSx(dashboardAccents.commands), p: 2 }}><Stack spacing={1}>
            <Typography sx={{ color: 'grey.50', fontWeight: 800, overflowWrap: 'anywhere' }}>{template.title}</Typography>
            <Typography sx={{ color: 'grey.300', overflowWrap: 'anywhere' }}>{template.question}</Typography>
            {template.ranked && <Typography sx={{ color: 'grey.400' }}>{t('pollTemplates.ranked')}</Typography>}
            {template.options.map((item, index) => <Typography key={index} sx={{ color: 'grey.300', overflowWrap: 'anywhere' }}>{index + 1}. {item}</Typography>)}
            <Typography sx={{ color: 'grey.400', overflowWrap: 'anywhere' }}>{t('pollTemplates.startHelp', { id: template.id })}</Typography>
            {removing?.id === template.id ? <>
                <Typography sx={{ color: 'grey.300' }}>{t('pollTemplates.removeHelp')}</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    <Button disabled={disabled} onClick={() => void remove(template)} sx={buttonSx}>{t('pollTemplates.confirmRemove')}</Button>
                    <Button disabled={disabled} onClick={() => setRemoving(null)} sx={buttonSx}>{t('pollTemplates.cancel')}</Button>
                </Stack>
            </> : <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                <Button disabled={disabled} onClick={() => setDialog({ template })} sx={buttonSx}>{t('pollTemplates.edit')}</Button>
                <Button disabled={disabled} onClick={() => setRemoving(template)} sx={buttonSx}>{t('pollTemplates.remove')}</Button>
            </Stack>}
        </Stack></Box>)}
        {pages > 1 && <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center', rowGap: 1 }}>
            <Button disabled={current <= 1} onClick={() => setPage(current - 1)} sx={buttonSx}>{t('pollTemplates.previous')}</Button>
            <Typography sx={{ color: 'grey.300' }}>{t('pollTemplates.page', { page: current, pages })}</Typography>
            <Button disabled={current >= pages} onClick={() => setPage(current + 1)} sx={buttonSx}>{t('pollTemplates.next')}</Button>
        </Stack>}
        {dialog && <PollTemplateDialog {...dialog} onClose={() => setDialog(null)} onSaved={() => void load()} />}
    </Stack></FeaturePanel>;
}
