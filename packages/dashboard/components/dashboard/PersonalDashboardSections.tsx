"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, IconButton, Stack, Typography } from '@mui/material';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import { defaultDashboardSections, type DashboardSectionId, type PersonalDashboardLayout } from '@zeffuro/fakegaming-common/dashboard-layout';
import { dashboardLayoutApi } from '@/lib/api/dashboardLayout';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { FeaturePanel } from './FeaturePanel';
import { dashboardAccents, ghostActionButtonSx } from './dashboardTheme';

export function PersonalDashboardSections({ panels }: { panels: Record<DashboardSectionId, ReactNode> }) {
    const { t } = useDashboardI18n();
    const [layout, setLayout] = useState<PersonalDashboardLayout>({ schemaVersion: 1, version: 0, sections: defaultDashboardSections() });
    const [ready, setReady] = useState(false); const [loaded, setLoaded] = useState(false); const [busy, setBusy] = useState(true);
    const [editing, setEditing] = useState(false); const [dirty, setDirty] = useState(false);
    const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false);
    const pending = useRef(false); const sequence = useRef(0);
    async function run(action: 'load' | 'save' | 'reset') {
        if (pending.current) return;
        pending.current = true; const current = ++sequence.current; setBusy(true); setError(null); setSaved(false);
        try {
            const value = action === 'load' ? await dashboardLayoutApi.get()
                : action === 'reset' ? await dashboardLayoutApi.reset(layout.version) : await dashboardLayoutApi.save(layout);
            if (current === sequence.current) { setLayout(value); setReady(true); setLoaded(true); setDirty(false); setSaved(action !== 'load'); }
        } catch (err) { if (current === sequence.current) setError(err instanceof Error ? err.message : t('dashboardLayout.failed')); }
        finally { pending.current = false; if (current === sequence.current) setBusy(false); }
    }
    useEffect(() => {
        const current = ++sequence.current; setBusy(true);
        void dashboardLayoutApi.get().then(value => {
            if (current === sequence.current) { setLayout(value); setReady(true); }
        }).catch(err => {
            if (current === sequence.current) setError(err instanceof Error ? err.message : t('dashboardLayout.failed'));
        }).finally(() => { if (current === sequence.current) { setLoaded(true); setBusy(false); } });
        return () => { sequence.current++; };
    }, []);
    function move(index: number, offset: number) {
        setLayout(value => {
            const sections = [...value.sections]; const target = index + offset;
            if (target < 0 || target >= sections.length) return value;
            [sections[index], sections[target]] = [sections[target], sections[index]];
            return { ...value, sections };
        });
        setDirty(true); setSaved(false);
    }
    const disabled = busy || !ready;
    const buttonSx = ghostActionButtonSx(dashboardAccents.settings);
    return <Stack spacing={3} sx={{ minWidth: 0 }}>
        <FeaturePanel accent={dashboardAccents.settings}>
            <Stack spacing={2} sx={{ position: 'relative', minWidth: 0 }}>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="h6" sx={{ color: 'grey.50', fontWeight: 900 }}>{t('dashboardLayout.title')}</Typography>
                    <Button aria-expanded={editing} onClick={() => setEditing(value => !value)} sx={buttonSx}>
                        {t(editing ? 'dashboardLayout.close' : 'dashboardLayout.customize')}
                    </Button>
                </Stack>
                {error && <Alert severity="error">{error}</Alert>}
                {saved && <Alert severity="success">{t('dashboardLayout.saved')}</Alert>}
                {busy && <Typography sx={{ color: 'grey.300' }}>{t('dashboardLayout.loading')}</Typography>}
                {editing && <>
                    <Typography sx={{ color: 'grey.300', overflowWrap: 'anywhere' }}>{t('dashboardLayout.description')}</Typography>
                    <Stack spacing={1}>
                        {layout.sections.map((section, index) => {
                            const name = t(`dashboardLayout.sections.${section.id}`);
                            return <Box key={section.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                                minWidth: 0, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2, px: 1 }}>
                                <FormControlLabel label={name} sx={{ color: 'grey.100', minWidth: 0, mr: 0, '& .MuiFormControlLabel-label': { overflowWrap: 'anywhere' } }}
                                    control={<Checkbox checked={section.visible} disabled={disabled} onChange={(_, visible) => {
                                        setLayout(value => ({ ...value, sections: value.sections.map(entry => entry.id === section.id ? { ...entry, visible } : entry) }));
                                        setDirty(true); setSaved(false);
                                    }} />} />
                                <Stack direction="row" sx={{ flexShrink: 0 }}>
                                    <IconButton aria-label={t('dashboardLayout.moveUp', { name })} disabled={disabled || index === 0}
                                        onClick={() => move(index, -1)} sx={{ color: 'grey.100' }}><ArrowUpward fontSize="small" /></IconButton>
                                    <IconButton aria-label={t('dashboardLayout.moveDown', { name })} disabled={disabled || index === layout.sections.length - 1}
                                        onClick={() => move(index, 1)} sx={{ color: 'grey.100' }}><ArrowDownward fontSize="small" /></IconButton>
                                </Stack>
                            </Box>;
                        })}
                    </Stack>
                    {dirty && <Typography role="status" sx={{ color: 'grey.300' }}>{t('dashboardLayout.unsaved')}</Typography>}
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                        <Button disabled={disabled || !dirty} onClick={() => void run('save')} sx={buttonSx}>{t('dashboardLayout.save')}</Button>
                        <Button disabled={disabled} onClick={() => void run('reset')} sx={buttonSx}>{t('dashboardLayout.reset')}</Button>
                        <Button disabled={busy} onClick={() => void run('load')} sx={buttonSx}>{t('dashboardLayout.reload')}</Button>
                    </Stack>
                </>}
            </Stack>
        </FeaturePanel>
        {loaded && layout.sections.filter(section => section.visible).map(section => <Fragment key={section.id}>{panels[section.id]}</Fragment>)}
    </Stack>;
}
