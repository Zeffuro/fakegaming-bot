"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Card, CardContent, Chip, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useGuildChannels } from "@/components/hooks/useGuildChannels";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { twitchClipsApi, type TwitchClipConfig, type TwitchClipInput, type TwitchClipPermission } from "@/lib/api/twitchClips";
import { TwitchClipBotConnection } from "./TwitchClipBotConnection";

const defaults: Omit<TwitchClipInput, "guildId"> = {
    twitchUsername: "", discordChannelId: "", command: "!clip", aliases: [], permission: "everyone",
    cooldownSeconds: 30, durationSeconds: 30, enabled: true,
};
const permissions: TwitchClipPermission[] = ["everyone", "subscribers", "moderators", "owner"];

export function TwitchClipSettings() {
    const { t } = useDashboardI18n();
    const { guildId, guild } = useGuildFromParams();
    const { channels, error: channelError, getChannelName } = useGuildChannels(guildId, { enabled: Boolean(guild) });
    const [configs, setConfigs] = useState<TwitchClipConfig[]>([]);
    const [form, setForm] = useState(defaults);
    const [aliases, setAliases] = useState("");
    const [editing, setEditing] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!guild) return;
        let active = true;
        void twitchClipsApi.list(guildId).then(value => { if (active) setConfigs(value); })
            .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : t("clips.failed")); });
        return () => { active = false; };
    }, [guildId, guild, t]);

    const reset = () => { setForm(defaults); setAliases(""); setEditing(null); };
    const edit = (config: TwitchClipConfig) => {
        setForm({
            twitchUsername: config.twitchUsername,
            discordChannelId: config.discordChannelId,
            command: config.command,
            aliases: config.aliases,
            permission: config.permission,
            cooldownSeconds: config.cooldownSeconds,
            durationSeconds: config.durationSeconds,
            enabled: config.enabled,
        });
        setAliases(config.aliases.join(", "));
        setEditing(config.id);
    };
    const perform = async (operation: () => Promise<unknown>, resetForm = false) => {
        setBusy(true);
        setError(null);
        try {
            await operation();
            setConfigs(await twitchClipsApi.list(guildId));
            if (resetForm) reset();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("clips.failed"));
        } finally { setBusy(false); }
    };
    const save = () => {
        const input: TwitchClipInput = { ...form, guildId, twitchUsername: form.twitchUsername.trim().replace(/^@/, ""), command: form.command.trim(), aliases: aliases.split(",").map(value => value.trim()).filter(Boolean) };
        if (!input.twitchUsername || !input.discordChannelId || !input.command || !Number.isInteger(input.cooldownSeconds)
            || input.cooldownSeconds < 15 || input.cooldownSeconds > 3600 || !Number.isInteger(input.durationSeconds)
            || input.durationSeconds < 5 || input.durationSeconds > 60) {
            setError(t("clips.invalid"));
            return;
        }
        void perform(() => editing ? twitchClipsApi.update(editing, input) : twitchClipsApi.create(input), true);
    };

    if (!guild) return null;
    return <Stack spacing={3}>
        <Typography variant="h5">{t("clips.title")}</Typography>
        <Typography color="text.secondary">{t("clips.description")}</Typography>
        <TwitchClipBotConnection guildId={guildId} />
        {error && <Alert severity="error">{error}</Alert>}
        {channelError && <Alert severity="warning">{channelError}</Alert>}
        <Card variant="outlined"><CardContent><Stack spacing={2}>
            <Typography variant="h6">{editing ? t("clips.editTitle") : t("clips.addTitle")}</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField fullWidth label={t("clips.username")} slotProps={{ inputLabel: { shrink: true } }} value={form.twitchUsername} onChange={event => setForm({ ...form, twitchUsername: event.target.value })} />
                <TextField fullWidth select label={t("clips.destination")} value={form.discordChannelId} onChange={event => setForm({ ...form, discordChannelId: event.target.value })}>
                    {form.discordChannelId && !channels.some(channel => channel.id === form.discordChannelId) && <MenuItem value={form.discordChannelId}>{form.discordChannelId}</MenuItem>}
                    {channels.filter(channel => channel.type === 0 || channel.type === 5).map(channel => <MenuItem key={channel.id} value={channel.id}>#{channel.name}</MenuItem>)}
                </TextField>
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField fullWidth label={t("clips.command")} value={form.command} onChange={event => setForm({ ...form, command: event.target.value })} />
                <TextField fullWidth label={t("clips.aliases")} helperText={t("clips.aliasesHelp")} value={aliases} onChange={event => setAliases(event.target.value)} />
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField fullWidth select label={t("clips.permission")} value={form.permission} onChange={event => setForm({ ...form, permission: event.target.value as TwitchClipPermission })}>
                    {permissions.map(permission => <MenuItem key={permission} value={permission}>{t(`clips.${permission}`)}</MenuItem>)}
                </TextField>
                <TextField fullWidth type="number" label={t("clips.cooldown")} value={form.cooldownSeconds} slotProps={{ htmlInput: { min: 15, max: 3600 } }} onChange={event => setForm({ ...form, cooldownSeconds: Number(event.target.value) })} />
                <TextField fullWidth type="number" label={t("clips.duration")} value={form.durationSeconds} slotProps={{ htmlInput: { min: 5, max: 60 } }} onChange={event => setForm({ ...form, durationSeconds: Number(event.target.value) })} />
            </Stack>
            <FormControlLabel label={t("clips.enabled")} control={<Switch checked={form.enabled} onChange={event => setForm({ ...form, enabled: event.target.checked })} />} />
            <Stack direction="row" spacing={1}><Button variant="contained" disabled={busy} onClick={save}>{editing ? t("clips.save") : t("clips.add")}</Button>{editing && <Button disabled={busy} onClick={reset}>{t("clips.cancel")}</Button>}</Stack>
        </Stack></CardContent></Card>
        {configs.length === 0 && <Alert severity="info">{t("clips.empty")}</Alert>}
        {configs.map(config => <Card variant="outlined" key={config.id}><CardContent><Stack spacing={1}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>{config.twitchUsername}</Typography><Chip size="small" label={config.enabled ? t("clips.enabled") : t("clips.paused")} /></Stack>
            <Typography sx={{ overflowWrap: "anywhere" }}>{config.command}{config.aliases.length ? ` (${config.aliases.join(", ")})` : ""} → {getChannelName(config.discordChannelId)}</Typography>
            <Typography variant="body2" color="text.secondary">{t("clips.summary", { permission: t(`clips.${config.permission}`), cooldown: config.cooldownSeconds, duration: config.durationSeconds })}</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Button disabled={busy} onClick={() => edit(config)}>{t("clips.edit")}</Button>
                <Button disabled={busy} onClick={() => void perform(() => twitchClipsApi.update(config.id, { enabled: !config.enabled }))}>{config.enabled ? t("clips.pause") : t("clips.resume")}</Button>
                <Button color="error" disabled={busy} onClick={() => void perform(() => twitchClipsApi.remove(config.id), editing === config.id)}>{t("clips.delete")}</Button>
            </Stack>
        </Stack></CardContent></Card>)}
    </Stack>;
}
