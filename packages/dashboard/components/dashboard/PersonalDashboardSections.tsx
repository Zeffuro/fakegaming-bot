"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import { Close, Tune } from '@mui/icons-material';
import { defaultDashboardSections, type DashboardSectionId, type PersonalDashboardLayout } from '@zeffuro/fakegaming-common/dashboard-layout';
import { dashboardLayoutApi } from '@/lib/api/dashboardLayout';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { PersonalDashboardCustomize } from './PersonalDashboardCustomize';
import { personalDashboardView, personalDashboardViews, sectionView, type PersonalDashboardView, type PersonalEditorId } from './personalDashboardViews';
import { dashboardAccents, ghostActionButtonSx } from './dashboardTheme';

export function PersonalDashboardSections({ panels, editorRequest = null, editorErrors = {}, editorBusy = false, onCreateEditor, onCloseEditor }: {
    panels: Record<DashboardSectionId, ReactNode>;
    editorRequest?: { id: PersonalEditorId } | null;
    editorErrors?: Partial<Record<PersonalEditorId, string | null>>;
    editorBusy?: boolean;
    onCreateEditor: (id: PersonalEditorId) => void;
    onCloseEditor: () => void;
}) {
    const { t } = useDashboardI18n();
    const [layout, setLayout] = useState<PersonalDashboardLayout>({ schemaVersion: 1, version: 0, sections: defaultDashboardSections() });
    const [ready, setReady] = useState(false); const [busy, setBusy] = useState(true);
    const [editing, setEditing] = useState(false); const [dirty, setDirty] = useState(false);
    const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false);
    const [view, setView] = useState<PersonalDashboardView>('overview');
    const [visited, setVisited] = useState<Set<PersonalDashboardView>>(new Set());
    const editor = editorRequest?.id ?? null;
    const pending = useRef(false); const sequence = useRef(0);
    async function run(action: 'load' | 'save' | 'reset') {
        if (pending.current) return;
        pending.current = true; const current = ++sequence.current; setBusy(true); setError(null); setSaved(false);
        try {
            const value = action === 'load' ? await dashboardLayoutApi.get()
                : action === 'reset' ? await dashboardLayoutApi.reset(layout.version) : await dashboardLayoutApi.save(layout);
            if (current === sequence.current) { setLayout(value); setReady(true); setDirty(false); setSaved(action !== 'load'); }
        } catch (err) { if (current === sequence.current) setError(err instanceof Error ? err.message : t('dashboardLayout.failed')); }
        finally { pending.current = false; if (current === sequence.current) setBusy(false); }
    }
    useEffect(() => {
        const current = ++sequence.current; setBusy(true);
        void dashboardLayoutApi.get().then(value => {
            if (current === sequence.current) { setLayout(value); setReady(true); }
        }).catch(err => {
            if (current === sequence.current) setError(err instanceof Error ? err.message : t('dashboardLayout.failed'));
        }).finally(() => { if (current === sequence.current) setBusy(false); });
        return () => { sequence.current++; };
    }, []);
    useEffect(() => {
        const read = () => {
            const next = personalDashboardView(window.location.search);
            setView(next); setVisited(value => new Set(value).add(next));
        };
        read(); window.addEventListener('popstate', read);
        return () => window.removeEventListener('popstate', read);
    }, []);
    function navigate(next: PersonalDashboardView) {
        setView(next); setVisited(value => new Set(value).add(next));
        const url = new URL(window.location.href); url.searchParams.set('view', next);
        window.history.pushState(null, '', url);
    }
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
    const visible = layout.sections.filter(section => section.visible);
    const selected = visible.filter(section => view === 'all' || sectionView(section.id) === view);
    const isEditor = (id: DashboardSectionId): id is PersonalEditorId => id === 'noteEditor' || id === 'reminderEditor';
    return <Stack spacing={2.5} sx={{ minWidth: 0 }}>
        <Stack direction="row" sx={{ minWidth: 0, alignItems: 'center', gap: 1 }}>
            <Tabs value={view} onChange={(_, next: PersonalDashboardView) => navigate(next)} variant="scrollable" scrollButtons="auto"
                allowScrollButtonsMobile aria-label={t('dashboardLayout.navigation')} sx={{ minWidth: 0, flex: 1,
                    bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 3, '& .MuiTab-root': { color: 'grey.300', textTransform: 'none', fontWeight: 800 },
                    '& .Mui-selected': { color: dashboardAccents.commands } }}>
                {personalDashboardViews.map(id => <Tab key={id} id={`personal-tab-${id}`} value={id}
                    aria-controls="personal-view-panels" label={t(`dashboardLayout.views.${id}`)} />)}
            </Tabs>
            <Tooltip title={t(editing ? 'dashboardLayout.close' : 'dashboardLayout.customize')}>
            <Button startIcon={<Tune />} aria-label={t(editing ? 'dashboardLayout.close' : 'dashboardLayout.customize')}
                aria-expanded={editing} onClick={() => setEditing(value => !value)} sx={{ ...buttonSx, minWidth: { xs: 40, md: 'auto' }, flexShrink: 0,
                    '& .MuiButton-startIcon': { m: { xs: 0, md: undefined }, mr: { md: 1 } } }}>
                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>{t(editing ? 'dashboardLayout.close' : 'dashboardLayout.customize')}</Box>
            </Button>
            </Tooltip>
        </Stack>
        {error && <Alert severity="error" action={<Button disabled={busy} onClick={() => void run('load')}>{t('dashboardLayout.reload')}</Button>}>{error}</Alert>}
        {saved && <Alert severity="success">{t('dashboardLayout.saved')}</Alert>}
        {busy && <Typography sx={{ color: 'grey.300' }}>{t('dashboardLayout.loading')}</Typography>}
        {editing && <PersonalDashboardCustomize layout={layout} disabled={disabled} busy={busy} dirty={dirty} onMove={move}
            onVisibility={(id, visibility) => {
                setLayout(value => ({ ...value, sections: value.sections.map(entry => entry.id === id ? { ...entry, visible: visibility } : entry) }));
                setDirty(true); setSaved(false);
            }} onAction={action => void run(action)} />}
        <Box id="personal-view-panels" role="tabpanel" aria-labelledby={`personal-tab-${view}`} sx={{ display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(12, minmax(0, 1fr))' }, gap: 3, alignItems: 'start', minWidth: 0 }}>
            {ready && visible.filter(section => visited.has('all') || visited.has(sectionView(section.id))).map(section => {
                const active = view === 'all' || sectionView(section.id) === view;
                const span = section.id === 'calendar' || section.id === 'notificationHistory' ? 12
                    : view === 'overview' ? section.id === 'today' ? 8 : 4 : 6;
                return <Box key={section.id} hidden={!active} data-personal-section={section.id}
                    sx={{ display: active ? 'block' : 'none', gridColumn: { md: `span ${span}` }, minWidth: 0 }}>
                    {isEditor(section.id) ? <Button onClick={() => onCreateEditor(section.id as PersonalEditorId)} sx={buttonSx}>
                        {t(section.id === 'noteEditor' ? 'personal.newNote' : 'personal.createReminder')}
                    </Button> : panels[section.id]}
                </Box>;
            })}
            {ready && selected.length === 0 && <Typography sx={{ color: 'grey.300', gridColumn: '1 / -1' }}>{t('dashboardLayout.emptyView')}</Typography>}
        </Box>
        <Dialog open={editor !== null} onClose={() => { if (!editorBusy) onCloseEditor(); }} fullWidth maxWidth="md"
            aria-labelledby="personal-editor-title" slotProps={{ paper: { sx: { bgcolor: '#101722', color: 'grey.50', backgroundImage: 'none' } } }}>
            <DialogTitle id="personal-editor-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {editor && t(`dashboardLayout.sections.${editor}`)}
                <IconButton disabled={editorBusy} aria-label={t('common.close')} onClick={onCloseEditor} sx={{ color: 'grey.100' }}><Close /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: { xs: 1, sm: 2 } }}>
                {editor && editorErrors[editor] && <Alert severity="error" sx={{ mb: 2 }}>{editorErrors[editor]}</Alert>}
                {editor && panels[editor]}
            </DialogContent>
        </Dialog>
    </Stack>;
}
