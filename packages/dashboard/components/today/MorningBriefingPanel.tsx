"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import { FeaturePanel } from '@/components/dashboard/FeaturePanel';
import { dashboardAccents, dashboardCardSx, ghostActionButtonSx } from '@/components/dashboard/dashboardTheme';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { morningBriefingsApi, type MorningBriefingPreferences, type MorningBriefingPreview } from '@/lib/api/morningBriefings';

export function MorningBriefingPanel({ revision }: { revision?: string }) {
    const { t } = useDashboardI18n();
    const [settings, setSettings] = useState<MorningBriefingPreferences | null>(null);
    const [preview, setPreview] = useState<MorningBriefingPreview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const pending = useRef(false); const sequence = useRef(0);
    const load = useCallback(async () => {
        const current = ++sequence.current; setLoading(true);
        try { const value = await morningBriefingsApi.get(); if (current === sequence.current) { setSettings(value); setError(null); setSaved(false); setPreview(null); } }
        catch (err) { if (current === sequence.current) setError(err instanceof Error ? err.message : t('briefing.failed')); }
        finally { if (current === sequence.current) setLoading(false); }
    }, [t]);
    useEffect(() => { void load(); return () => { sequence.current++; }; }, [load, revision]);
    async function run(action: 'save' | 'preview') {
        if (pending.current || !settings) return;
        pending.current = true; const current = ++sequence.current; setBusy(true); setError(null); setSaved(false);
        try {
            if (action === 'save') {
                const result = await morningBriefingsApi.save(settings);
                if (current === sequence.current) { setSettings(result); setSaved(true); setPreview(null); }
            } else {
                const result = await morningBriefingsApi.preview(); if (current === sequence.current) setPreview(result);
            }
        } catch (err) { if (current === sequence.current) setError(err instanceof Error ? err.message : t('briefing.failed')); }
        finally { pending.current = false; setBusy(false); }
    }
    const disabled = busy || loading || !settings;
    const valid = settings && /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.localTime);
    const buttonSx = ghostActionButtonSx(dashboardAccents.commands);
    return <FeaturePanel accent={dashboardAccents.commands}><Stack spacing={2} sx={{ position: 'relative', minWidth: 0 }}>
        <Typography variant="h5" sx={{ color: 'grey.50', fontWeight: 900 }}>{t('briefing.title')}</Typography>
        <Typography sx={{ color: 'grey.300', overflowWrap: 'anywhere' }}>{t('briefing.description')}</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {saved && <Alert severity="success">{t('briefing.saved')}</Alert>}
        {loading && <Typography sx={{ color: 'grey.300' }}>{t('briefing.loading')}</Typography>}
        {settings && <>
            <FormControlLabel sx={{ color: 'grey.100' }} label={t('briefing.enabled')} control={<Switch checked={settings.enabled} disabled={disabled}
                onChange={(_, enabled) => { setSettings({ ...settings, enabled }); setSaved(false); setPreview(null); }} />} />
            <TextField label={t('briefing.localTime')} type="time" value={settings.localTime} disabled={disabled}
                slotProps={{ inputLabel: { shrink: true } }} sx={{ maxWidth: 220, '& input': { colorScheme: 'dark' } }}
                onChange={event => { setSettings({ ...settings, localTime: event.target.value }); setSaved(false); setPreview(null); }} />
            <Typography sx={{ color: 'grey.300', overflowWrap: 'anywhere' }}>{t('briefing.timezone', { timezone: settings.timezone })}</Typography>
            <Typography sx={{ color: 'grey.400', overflowWrap: 'anywhere' }}>{t('briefing.timing')}</Typography>
        </>}
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Button disabled={disabled || !valid} onClick={() => void run('save')} sx={buttonSx}>{t('briefing.save')}</Button>
            <Button disabled={disabled} onClick={() => void run('preview')} sx={buttonSx}>{t('briefing.preview')}</Button>
            <Button disabled={busy || loading} onClick={() => void load()} sx={buttonSx}>{t('briefing.refresh')}</Button>
        </Stack>
        <Typography sx={{ color: 'grey.400', overflowWrap: 'anywhere' }}>{t('briefing.previewHelp')}</Typography>
        {preview && <Box sx={{ ...dashboardCardSx(dashboardAccents.commands), p: 2, minWidth: 0 }}>
            {preview.empty && <Typography sx={{ color: 'grey.300' }}>{t('briefing.empty')}</Typography>}
            <Typography component="pre" sx={{ color: 'grey.100', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'inherit', m: 0 }}>{preview.content}</Typography>
            <Typography sx={{ color: 'grey.400', mt: 1 }}>{t('briefing.previewCount', { included: preview.included, total: preview.total, omitted: preview.omitted })}</Typography>
        </Box>}
    </Stack></FeaturePanel>;
}
