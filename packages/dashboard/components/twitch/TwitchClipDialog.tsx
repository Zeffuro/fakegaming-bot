"use client";
import { Alert, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { ConfigDialogShell } from "@/components/config-dialog/ConfigDialogShell";
import { dashboardAccents, dashboardFieldSx } from "@/components/dashboard/dashboardTheme";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import type { TwitchClipInput, TwitchClipPermission } from "@/lib/api/twitchClips";

type ClipForm = Omit<TwitchClipInput, "guildId">;
interface TwitchClipDialogProps {
    open: boolean;
    editing: boolean;
    form: ClipForm;
    onChange: (form: ClipForm) => void;
    aliases: string;
    onAliasesChange: (value: string) => void;
    channels: { id: string; name: string; type: number }[];
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onSave: () => void;
}
const permissions: TwitchClipPermission[] = ["everyone", "subscribers", "moderators", "owner"];
const fieldSx = dashboardFieldSx(dashboardAccents.twitch);

export function TwitchClipDialog({ open, editing, form, onChange, aliases, onAliasesChange, channels, busy, error, onClose, onSave }: TwitchClipDialogProps) {
    const { t } = useDashboardI18n();
    return <ConfigDialogShell open={open} onClose={() => { if (!busy) onClose(); }} title={editing ? t("clips.editTitle") : t("clips.addTitle")}
        moduleColor={dashboardAccents.twitch} saving={busy} submitLabel={editing ? t("clips.save") : t("clips.add")} onSubmit={onSave}
        paperSx={{ backgroundImage: "linear-gradient(145deg, rgba(145,70,255,0.14), transparent 55%)", m: { xs: 1.5, sm: 4 }, width: { xs: "calc(100% - 24px)", sm: "calc(100% - 64px)" }, maxHeight: { xs: "calc(100% - 24px)", sm: "calc(100% - 64px)" } }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField fullWidth sx={fieldSx} label={t("clips.username")} value={form.twitchUsername} onChange={event => onChange({ ...form, twitchUsername: event.target.value })} />
            <TextField fullWidth sx={fieldSx} select label={t("clips.destination")} value={form.discordChannelId} onChange={event => onChange({ ...form, discordChannelId: event.target.value })}>
                {form.discordChannelId && !channels.some(channel => channel.id === form.discordChannelId) && <MenuItem value={form.discordChannelId}>{form.discordChannelId}</MenuItem>}
                {channels.filter(channel => channel.type === 0 || channel.type === 5).map(channel => <MenuItem key={channel.id} value={channel.id}>#{channel.name}</MenuItem>)}
            </TextField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField fullWidth sx={fieldSx} label={t("clips.command")} helperText={t("clips.commandHelp", { command: form.command.trim() || "!clip" })} value={form.command} onChange={event => onChange({ ...form, command: event.target.value })} />
                <TextField fullWidth sx={fieldSx} label={t("clips.aliases")} helperText={t("clips.aliasesHelp")} value={aliases} onChange={event => onAliasesChange(event.target.value)} />
            </Stack>
            <TextField fullWidth sx={fieldSx} select label={t("clips.permission")} value={form.permission} onChange={event => onChange({ ...form, permission: event.target.value as TwitchClipPermission })}>
                {permissions.map(permission => <MenuItem key={permission} value={permission}>{t(`clips.${permission}`)}</MenuItem>)}
            </TextField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField fullWidth sx={fieldSx} type="number" label={t("clips.cooldown")} helperText={t("clips.cooldownHelp")} value={form.cooldownSeconds} slotProps={{ htmlInput: { min: 15, max: 3600 } }} onChange={event => onChange({ ...form, cooldownSeconds: Number(event.target.value) })} />
                <TextField fullWidth sx={fieldSx} type="number" label={t("clips.duration")} helperText={t("clips.durationHelp")} value={form.durationSeconds} slotProps={{ htmlInput: { min: 5, max: 60 } }} onChange={event => onChange({ ...form, durationSeconds: Number(event.target.value) })} />
            </Stack>
            <FormControlLabel label={t("clips.enabled")} control={<Switch checked={form.enabled} onChange={event => onChange({ ...form, enabled: event.target.checked })} />} />
            <Stack spacing={1.5} sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(145,70,255,0.08)", border: "1px solid rgba(145,70,255,0.20)" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 850, color: "grey.100" }}>{t("clips.replyTitle")}</Typography>
                <FormControlLabel sx={{ m: 0 }} label={t("clips.replyEnabled")} control={<Switch checked={form.replyEnabled} onChange={event => onChange({ ...form, replyEnabled: event.target.checked })} />} />
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.65)" }}>{t("clips.replyLocaleHelp")}</Typography>
                <TextField fullWidth multiline minRows={2} sx={fieldSx} disabled={!form.replyEnabled} label={t("clips.replyTemplate")}
                    value={form.replyTemplate ?? ""} helperText={t("clips.replyTemplateHelp", { url: "{url}", user: "{user}", channel: "{channel}" })}
                    slotProps={{ htmlInput: { maxLength: 400 } }} onChange={event => onChange({ ...form, replyTemplate: event.target.value })} />
            </Stack>
        </Stack>
    </ConfigDialogShell>;
}
