"use client";

import { useState } from 'react';
import { Alert, Autocomplete, FormControlLabel, MenuItem, Stack, Switch, TextField } from '@mui/material';
import { ConfigDialogShell } from '@/components/config-dialog/ConfigDialogShell';
import { dashboardAccents, dashboardFieldSx } from '@/components/dashboard/dashboardTheme';
import { useDashboardI18n } from '@/components/i18n/DashboardI18nProvider';
import { submissionsApi, type SubmissionCategory, type SubmissionCategoryInput, type SubmissionOptions } from '@/lib/api/submissions';

interface Props {
    guildId: string;
    category?: SubmissionCategory;
    options: SubmissionOptions;
    onClose: () => void;
    onSaved: () => Promise<void>;
}

const accent = dashboardAccents.commands;
const fieldSx = dashboardFieldSx(accent);

export function SubmissionCategoryDialog({ guildId, category, options, onClose, onSaved }: Props) {
    const { t } = useDashboardI18n();
    const [form, setForm] = useState<SubmissionCategoryInput>(category ? {
        name: category.name, destinationChannelId: category.destinationChannelId,
        reviewChannelId: category.reviewChannelId, reviewerRoleIds: [...category.reviewerRoleIds],
        submitterRoleIds: [...category.submitterRoleIds], enabled: category.enabled,
    } : { name: '', destinationChannelId: '', reviewChannelId: '', reviewerRoleIds: [], submitterRoleIds: [], enabled: true });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const destinations = options.channels.filter(channel => channel.type === 0 || channel.type === 5);
    const reviews = options.channels.filter(channel => channel.type === 0);
    const roles = options.roles.filter(role => role.id !== guildId);
    const reviewers = roles.filter(role => !role.managed);
    const valid = form.name.trim().length > 0 && form.name.trim().length <= 80
        && /^\d{1,32}$/.test(form.destinationChannelId) && /^\d{1,32}$/.test(form.reviewChannelId)
        && form.destinationChannelId !== form.reviewChannelId
        && form.reviewerRoleIds.length > 0 && form.reviewerRoleIds.length <= 20
        && form.submitterRoleIds.length <= 20
        && (!form.enabled || (destinations.some(channel => channel.id === form.destinationChannelId)
            && reviews.some(channel => channel.id === form.reviewChannelId)
            && form.reviewerRoleIds.every(id => reviewers.some(role => role.id === id))
            && form.submitterRoleIds.every(id => roles.some(role => role.id === id))));

    async function save() {
        if (!valid || busy) return;
        setBusy(true);
        setError(null);
        try {
            const input = { ...form, name: form.name.trim() };
            if (category) await submissionsApi.update(guildId, category.id, input, category.version);
            else await submissionsApi.create(guildId, input);
            await onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('submissions.failed'));
        } finally {
            setBusy(false);
        }
    }

    return <ConfigDialogShell open onClose={() => { if (!busy) onClose(); }}
        title={t(category ? 'submissions.edit' : 'submissions.add')} moduleColor={accent}
        saving={busy} submitDisabled={!valid} submitLabel={t('submissions.save')} onSubmit={save}
        paperSx={{ m: { xs: 1.5, sm: 4 }, width: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' }, maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' } }}>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}<br />{t('submissions.retryHelp')}</Alert>}
            <TextField fullWidth disabled={busy} sx={fieldSx} label={t('submissions.name')}
                value={form.name} slotProps={{ htmlInput: { maxLength: 80 } }}
                onChange={event => setForm({ ...form, name: event.target.value })} />
            <TextField fullWidth select disabled={busy} sx={fieldSx} label={t('submissions.destination')}
                value={form.destinationChannelId} helperText={t('submissions.destinationHelp')}
                onChange={event => setForm({ ...form, destinationChannelId: event.target.value })}>
                {form.destinationChannelId && !destinations.some(channel => channel.id === form.destinationChannelId) && <MenuItem disabled value={form.destinationChannelId}>{form.destinationChannelId}</MenuItem>}
                {destinations.map(channel => <MenuItem key={channel.id} value={channel.id}>#{channel.name}</MenuItem>)}
            </TextField>
            <TextField fullWidth select disabled={busy} sx={fieldSx} label={t('submissions.reviewChannel')}
                value={form.reviewChannelId} helperText={t('submissions.reviewHelp')}
                onChange={event => setForm({ ...form, reviewChannelId: event.target.value })}>
                {form.reviewChannelId && !reviews.some(channel => channel.id === form.reviewChannelId) && <MenuItem disabled value={form.reviewChannelId}>{form.reviewChannelId}</MenuItem>}
                {reviews.map(channel => <MenuItem key={channel.id} value={channel.id}>#{channel.name}</MenuItem>)}
            </TextField>
            {(['reviewerRoleIds', 'submitterRoleIds'] as const).map(field => {
                const available = field === 'reviewerRoleIds' ? reviewers : roles;
                const selected = form[field].map(id => available.find(role => role.id === id) ?? { id, name: id, managed: false });
                return <Autocomplete key={field} multiple disableCloseOnSelect disabled={busy} options={available}
                    value={selected} getOptionLabel={role => role.name} isOptionEqualToValue={(left, right) => left.id === right.id}
                    getOptionDisabled={role => form[field].length >= 20 && !form[field].includes(role.id)}
                    onChange={(_event, values) => setForm({ ...form, [field]: values.map(role => role.id) })}
                    renderInput={params => <TextField {...params} sx={fieldSx}
                        label={t(field === 'reviewerRoleIds' ? 'submissions.reviewers' : 'submissions.submitters')}
                        helperText={t(field === 'reviewerRoleIds' ? 'submissions.reviewersHelp' : 'submissions.submittersHelp')} />} />;
            })}
            <FormControlLabel label={t('submissions.enabled')} control={<Switch disabled={busy} checked={form.enabled}
                onChange={event => setForm({ ...form, enabled: event.target.checked })} />} />
        </Stack>
    </ConfigDialogShell>;
}
