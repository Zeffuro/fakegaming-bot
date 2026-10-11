"use client";

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx } from '@/components/dashboard/dashboardTheme';
import { checklistsApi, type ChecklistTemplate } from '@/lib/api/checklists';
import { userSettingsApi } from '@/lib/api/userSettings';

export function ChecklistDialog({ template, initial, start = false, onClose, onSaved }: {
    template?: ChecklistTemplate; initial?: { title: string; items: string[] }; start?: boolean;
    onClose: () => void; onSaved: () => void;
}) {
    const { t } = useDashboardI18n();
    const [title, setTitle] = useState(template?.title ?? initial?.title ?? '');
    const [text, setText] = useState((template?.items ?? initial?.items ?? []).join('\n'));
    const [due, setDue] = useState('');
    const [timezone, setTimezone] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pending = useRef(false);
    const items = text.split('\n').map(value => value.trim()).filter(Boolean);
    const valid = start ? timezone !== null : title.trim().length > 0 && title.trim().length <= 120
        && items.length >= 1 && items.length <= 10 && items.every(item => item.length <= 120);
    useEffect(() => {
        if (!start) return;
        let active = true;
        void userSettingsApi.getUserSettings().then(settings => { if (active) setTimezone(settings.timezone?.trim() || 'UTC'); })
            .catch(err => { if (active) setError(err instanceof Error ? err.message : t('checklists.failed')); });
        return () => { active = false; };
    }, [start, t]);
    async function save() {
        if (!valid || pending.current) return;
        pending.current = true; setBusy(true); setError(null);
        try {
            if (start && template && timezone) {
                await checklistsApi.start(template.id, { version: template.version, due: due || null, timezone });
                window.dispatchEvent(new Event('personal-today-refresh'));
            } else if (template) await checklistsApi.edit(template.id, { title: title.trim(), items, version: template.version });
            else await checklistsApi.create({ title: title.trim(), items });
            onSaved(); onClose();
        } catch (err) { setError(err instanceof Error ? err.message : t('checklists.failed')); }
        finally { pending.current = false; setBusy(false); }
    }
    const fieldSx = dashboardFieldSx(dashboardAccents.commands);
    const buttonSx = ghostActionButtonSx(dashboardAccents.commands);
    return <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!busy) onClose(); }} slotProps={{ paper: { sx: { bgcolor: '#101725', color: 'grey.50', backgroundImage: 'none' } } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>{t(start ? 'checklists.start' : template ? 'checklists.edit' : 'checklists.create')}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {start ? <>
                <Typography sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{template?.title}</Typography>
                <Typography sx={{ color: 'grey.300', overflowWrap: 'anywhere' }}>{t('checklists.fresh')}</Typography>
                <TextField type="datetime-local" label={t('checklists.due')} value={due} disabled={busy} onChange={event => setDue(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={fieldSx} />
                <Typography sx={{ color: 'grey.400', overflowWrap: 'anywhere' }}>{timezone ? t('checklists.timezone', { timezone }) : t('checklists.loading')}</Typography>
            </> : <>
                <TextField label={t('checklists.name')} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} slotProps={{ htmlInput: { maxLength: 120 } }} sx={fieldSx} />
                <TextField multiline minRows={3} maxRows={10} label={t('checklists.items')} helperText={t('checklists.itemsHelp')} value={text} disabled={busy} onChange={event => setText(event.target.value)} slotProps={{ htmlInput: { maxLength: 1210 } }} sx={fieldSx} />
                <Typography variant="body2" sx={{ color: 'grey.400' }}>{t('checklists.independent')}</Typography>
            </>}
        </Stack></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Button disabled={busy} onClick={onClose} sx={buttonSx}>{t('checklists.cancel')}</Button>
            <Button disabled={busy || !valid} onClick={() => void save()} sx={buttonSx}>{t(busy ? 'checklists.saving' : start ? 'checklists.start' : 'checklists.save')}</Button>
        </DialogActions>
    </Dialog>;
}
