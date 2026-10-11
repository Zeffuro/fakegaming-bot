"use client";

import { useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { dashboardAccents, dashboardFieldSx, ghostActionButtonSx } from '@/components/dashboard/dashboardTheme';
import { pollTemplatesApi, type PollTemplate } from '@/lib/api/pollTemplates';

export function PollTemplateDialog({ template, onClose, onSaved }: {
    template?: PollTemplate; onClose: () => void; onSaved: () => void;
}) {
    const { t } = useDashboardI18n();
    const [title, setTitle] = useState(template?.title ?? '');
    const [question, setQuestion] = useState(template?.question ?? '');
    const [text, setText] = useState(template?.options.join('\n') ?? '');
    const [duration, setDuration] = useState(String(template?.durationMinutes ?? 10));
    const [multiple, setMultiple] = useState(template?.allowMultiple ?? false);
    const [hidden, setHidden] = useState(template?.hideResults ?? false);
    const [ranked, setRanked] = useState(template?.ranked ?? false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pending = useRef(false);
    const options = text.split('\n').map(value => value.trim()).filter(Boolean);
    const minutes = Number(duration);
    const valid = title.trim().length > 0 && title.trim().length <= 120 && question.trim().length > 0 && question.trim().length <= 200
        && options.length >= 2 && options.length <= 5 && options.every(option => option.length <= 200)
        && new Set(options.map(option => option.normalize('NFKC').toLowerCase())).size === options.length
        && Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440;
    async function save() {
        if (!valid || pending.current) return;
        pending.current = true; setBusy(true); setError(null);
        try {
            const input = { title: title.trim(), question: question.trim(), options, durationMinutes: minutes, allowMultiple: multiple, hideResults: hidden, ranked };
            if (template) await pollTemplatesApi.edit(template.id, { ...input, version: template.version });
            else await pollTemplatesApi.create(input);
            onSaved(); onClose();
        } catch (err) { setError(err instanceof Error ? err.message : t('pollTemplates.failed')); }
        finally { pending.current = false; setBusy(false); }
    }
    const fieldSx = dashboardFieldSx(dashboardAccents.commands); const buttonSx = ghostActionButtonSx(dashboardAccents.commands);
    return <Dialog open fullWidth maxWidth="sm" onClose={() => { if (!busy) onClose(); }} slotProps={{ paper: { sx: { bgcolor: '#101725', color: 'grey.50', backgroundImage: 'none' } } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>{t(template ? 'pollTemplates.edit' : 'pollTemplates.create')}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label={t('pollTemplates.name')} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} slotProps={{ htmlInput: { maxLength: 120 } }} sx={fieldSx} />
            <TextField label={t('pollTemplates.question')} value={question} disabled={busy} onChange={event => setQuestion(event.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} sx={fieldSx} />
            <TextField multiline minRows={3} maxRows={5} label={t('pollTemplates.options')} helperText={t('pollTemplates.optionsHelp')} value={text} disabled={busy} onChange={event => setText(event.target.value)} slotProps={{ htmlInput: { maxLength: 1004 } }} sx={fieldSx} />
            <TextField type="number" label={t('pollTemplates.duration')} value={duration} disabled={busy} onChange={event => setDuration(event.target.value)} slotProps={{ htmlInput: { min: 1, max: 1440 } }} sx={fieldSx} />
            <FormControlLabel control={<Checkbox checked={ranked} disabled={busy} onChange={event => { setRanked(event.target.checked); if (event.target.checked) setMultiple(false); }} />} label={t('pollTemplates.ranked')} />
            <Typography variant="body2" sx={{ color: 'grey.400' }}>{t('pollTemplates.rankedHelp')}</Typography>
            <FormControlLabel control={<Checkbox checked={multiple} disabled={busy || ranked} onChange={event => setMultiple(event.target.checked)} />} label={t('pollTemplates.multiple')} />
            <FormControlLabel control={<Checkbox checked={hidden} disabled={busy} onChange={event => setHidden(event.target.checked)} />} label={t('pollTemplates.hidden')} />
            <Typography variant="body2" sx={{ color: 'grey.400' }}>{t('pollTemplates.independent')}</Typography>
        </Stack></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Button disabled={busy} onClick={onClose} sx={buttonSx}>{t('pollTemplates.cancel')}</Button>
            <Button disabled={busy || !valid} onClick={() => void save()} sx={buttonSx}>{t(busy ? 'pollTemplates.saving' : 'pollTemplates.save')}</Button>
        </DialogActions>
    </Dialog>;
}
