"use client";
import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Add from "@mui/icons-material/Add";
import MovieCreationOutlined from "@mui/icons-material/MovieCreationOutlined";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useGuildChannels } from "@/components/hooks/useGuildChannels";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, dashboardCardSx, dangerActionButtonSx, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { twitchClipsApi, type TwitchClipConfig, type TwitchClipInput } from "@/lib/api/twitchClips";
import { TwitchClipBotConnection } from "./TwitchClipBotConnection";
import { TwitchClipDialog } from "./TwitchClipDialog";

const accent = dashboardAccents.twitch;
const defaults: Omit<TwitchClipInput, "guildId"> = {
    twitchUsername: "", discordChannelId: "", command: "!clip", aliases: [], permission: "everyone",
    cooldownSeconds: 30, durationSeconds: 30, enabled: true, replyEnabled: true, replyTemplate: null,
};

export function TwitchClipSettings() {
    const { t } = useDashboardI18n();
    const { guildId, guild } = useGuildFromParams();
    const { channels, error: channelError, getChannelName } = useGuildChannels(guildId, { enabled: Boolean(guild) });
    const [configs, setConfigs] = useState<TwitchClipConfig[]>([]);
    const [form, setForm] = useState(defaults);
    const [aliases, setAliases] = useState("");
    const [editing, setEditing] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!guild) return;
        let active = true;
        void twitchClipsApi.list(guildId).then(value => { if (active) setConfigs(value); })
            .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : t("clips.failed")); });
        return () => { active = false; };
    }, [guildId, guild, t]);

    const reset = () => { setForm(defaults); setAliases(""); setEditing(null); setDialogOpen(false); };
    const edit = (config: TwitchClipConfig) => {
        setForm({
            twitchUsername: config.twitchUsername, discordChannelId: config.discordChannelId,
            command: config.command, aliases: config.aliases, permission: config.permission,
            cooldownSeconds: config.cooldownSeconds, durationSeconds: config.durationSeconds,
            enabled: config.enabled, replyEnabled: config.replyEnabled ?? true, replyTemplate: config.replyTemplate ?? null,
        });
        setAliases(config.aliases.join(", "));
        setEditing(config.id);
        setError(null);
        setDialogOpen(true);
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
        const input: TwitchClipInput = {
            ...form, guildId, twitchUsername: form.twitchUsername.trim().replace(/^@/, ""), command: form.command.trim(),
            aliases: aliases.split(",").map(value => value.trim()).filter(Boolean),
            replyTemplate: form.replyTemplate?.trim() ? form.replyTemplate : null,
        };
        if (!input.twitchUsername || !input.discordChannelId || !input.command || !Number.isInteger(input.cooldownSeconds)
            || input.cooldownSeconds < 15 || input.cooldownSeconds > 3600 || !Number.isInteger(input.durationSeconds)
            || input.durationSeconds < 5 || input.durationSeconds > 60) {
            setError(t("clips.invalid"));
            return;
        }
        if ((input.replyTemplate?.length ?? 0) > 400) {
            setError(t("clips.replyTooLong"));
            return;
        }
        void perform(() => editing ? twitchClipsApi.update(editing, input) : twitchClipsApi.create(input), true);
    };

    if (!guild) return null;
    return <Stack spacing={3} sx={{ minWidth: 0 }}>
        <FeatureHero icon={<MovieCreationOutlined />} eyebrow={t("clips.eyebrow")} title={t("clips.title")}
            description={t("clips.description")} accent={accent} secondaryAccent={dashboardAccents.settings}
            actions={<Button variant="contained" startIcon={<Add />} disabled={busy} sx={primaryActionButtonSx(accent)}
                onClick={() => { reset(); setError(null); setDialogOpen(true); }}>{t("clips.add")}</Button>} />
        <TwitchClipBotConnection guildId={guildId} />
        {error && !dialogOpen && <Alert severity="error">{error}</Alert>}
        {channelError && <Alert severity="warning">{channelError}</Alert>}
        <FeaturePanel accent={accent} sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2} sx={{ position: "relative" }}>
                <Box><Typography variant="h6" sx={{ fontWeight: 850, color: "grey.50" }}>{t("clips.configuredTitle")}</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)", mt: 0.5 }}>{t("clips.configuredHelp")}</Typography></Box>
                {configs.length === 0 && <Typography sx={{ color: "rgba(255,255,255,0.68)", py: 2 }}>{t("clips.empty")}</Typography>}
                {configs.map(config => <Card key={config.id} sx={dashboardCardSx(accent)}><CardContent><Stack spacing={1.5}>
                    <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                        <Typography variant="h6" sx={{ fontWeight: 850, color: "grey.50", overflowWrap: "anywhere", minWidth: 0 }}>{config.twitchUsername}</Typography>
                        <Chip size="small" label={config.enabled ? t("clips.enabled") : t("clips.paused")}
                            sx={{ bgcolor: config.enabled ? "rgba(145,70,255,0.18)" : "rgba(255,255,255,0.07)", color: "grey.100" }} />
                        <Chip size="small" label={config.replyEnabled === false ? t("clips.replyOff") : config.replyTemplate ? t("clips.replyCustom") : t("clips.replyDefault")}
                            sx={{ bgcolor: "rgba(255,255,255,0.07)", color: "grey.100" }} />
                    </Stack>
                    <Typography sx={{ color: "grey.100", overflowWrap: "anywhere" }}>{config.command}{config.aliases.length ? ` (${config.aliases.join(", ")})` : ""} → {getChannelName(config.discordChannelId)}</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)" }}>{t("clips.summary", { permission: t(`clips.${config.permission}`), cooldown: config.cooldownSeconds, duration: config.durationSeconds })}</Typography>
                    <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap" }}>
                        <Button variant="outlined" disabled={busy} sx={ghostActionButtonSx(accent)} onClick={() => edit(config)}>{t("clips.edit")}</Button>
                        <Button variant="outlined" disabled={busy} sx={ghostActionButtonSx(accent)} onClick={() => void perform(() => twitchClipsApi.update(config.id, { enabled: !config.enabled }))}>{config.enabled ? t("clips.pause") : t("clips.resume")}</Button>
                        <Button variant="outlined" disabled={busy} sx={dangerActionButtonSx} onClick={() => void perform(() => twitchClipsApi.remove(config.id), editing === config.id)}>{t("clips.delete")}</Button>
                    </Stack>
                </Stack></CardContent></Card>)}
            </Stack>
        </FeaturePanel>
        <TwitchClipDialog open={dialogOpen} editing={editing !== null} form={form} onChange={setForm} aliases={aliases}
            onAliasesChange={setAliases} channels={channels} busy={busy} error={error} onClose={reset} onSave={save} />
    </Stack>;
}
