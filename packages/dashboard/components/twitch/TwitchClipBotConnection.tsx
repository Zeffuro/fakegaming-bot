"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, dangerActionButtonSx, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useAdminAccess } from "@/components/hooks/useAdmin";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { twitchClipsApi, type TwitchClipBotStatus } from "@/lib/api/twitchClips";
import type { DashboardMessageKey } from "@/lib/i18n/messages";

const runtimeErrorKeys: Record<string, DashboardMessageKey> = {
    channel_limit: "clips.channelLimit",
    bot_connection_unavailable: "clips.botUnavailable",
    chat_authorization_revoked: "clips.authorizationRevoked",
    chat_subscription_failed: "clips.subscriptionFailed",
    chat_connection_failed: "clips.connectionFailed",
    chat_event_failed: "clips.eventFailed",
    chat_reply_failed: "clips.replyFailed",
    chat_reply_authorization_required: "clips.replyReconnect",
};

export function TwitchClipBotConnection({ guildId }: { guildId?: string }) {
    const { t } = useDashboardI18n();
    const { isAdmin } = useAdminAccess();
    const [status, setStatus] = useState<TwitchClipBotStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [callbackResult, setCallbackResult] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        void twitchClipsApi.status().then(value => { if (active) setStatus(value); })
            .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : t("clips.failed")); });
        setCallbackResult(new URLSearchParams(window.location.search).get("twitchBot"));
        return () => { active = false; };
    }, [t]);

    const changeConnection = async (disconnect: boolean) => {
        setBusy(true);
        setError(null);
        try {
            if (disconnect) {
                await twitchClipsApi.disconnect();
                setStatus(await twitchClipsApi.status());
            } else {
                const result = await twitchClipsApi.connect(guildId);
                window.location.assign(result.url);
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("clips.failed"));
        } finally {
            setBusy(false);
        }
    };

    const refreshStatus = async () => {
        setBusy(true);
        setError(null);
        try {
            setStatus(await twitchClipsApi.status());
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("clips.failed"));
        } finally {
            setBusy(false);
        }
    };

    const accent = dashboardAccents.twitch;
    return <FeaturePanel accent={accent} sx={{ p: { xs: 2, md: 3 } }}><Stack spacing={2} sx={{ position: "relative" }}>
        <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850 }}>{t("clips.botTitle")}</Typography>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.65)" }}>{t("clips.botDescription")}</Typography>
        {callbackResult === "success" && <Alert severity="success">{t("clips.connectedSuccess")}</Alert>}
        {callbackResult === "error" && <Alert severity="error">{t("clips.oauthError")}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <Button variant="outlined" disabled={busy} onClick={() => void refreshStatus()} sx={{ ...ghostActionButtonSx(accent), alignSelf: "flex-start" }}>{t("clips.refreshStatus")}</Button>
        {status && <>
            <Alert severity={status.connected ? "success" : "warning"}>
                {status.connected ? t("clips.connected", { login: status.login ?? status.expectedLogin ?? "" }) : t("clips.disconnected")}
            </Alert>
            {status.connected && <Typography variant="body2">{status.chatConnected ? t("clips.chatConnected", { count: status.subscribedChannels }) : t("clips.chatDisconnected")}</Typography>}
            {status.connected && status.chatReplyAuthorized === false && <Alert severity="warning">{t("clips.replyReconnect")}</Alert>}
            {!status.jobsEnabled && <Alert severity="warning">{t("clips.jobsDisabled")}</Alert>}
            {status.lastErrorCode && !(status.connected && status.chatReplyAuthorized === false && status.lastErrorCode === "chat_reply_authorization_required")
                && <Alert severity="warning">{t(runtimeErrorKeys[status.lastErrorCode] ?? "clips.runtimeError", { code: status.lastErrorCode })}</Alert>}
            {!status.configured && <Alert severity="info">{t("clips.notConfigured")}</Alert>}
            {isAdmin ? <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap" }}>
                <Button variant="contained" sx={primaryActionButtonSx(accent)} disabled={busy || !status.configured} onClick={() => void changeConnection(false)}>{status.connected && status.chatReplyAuthorized === false ? t("clips.reconnect") : t("clips.connect")}</Button>
                {status.connected && <Button variant="outlined" sx={dangerActionButtonSx} disabled={busy} onClick={() => void changeConnection(true)}>{t("clips.disconnect")}</Button>}
            </Stack> : <Typography variant="body2" color="text.secondary">{t("clips.operatorHelp")}</Typography>}
        </>}
    </Stack></FeaturePanel>;
}
