"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Card, CardContent, Stack, Typography } from "@mui/material";
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

    return <Card variant="outlined"><CardContent><Stack spacing={2}>
        <Typography variant="h6">{t("clips.botTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">{t("clips.botDescription")}</Typography>
        {callbackResult === "success" && <Alert severity="success">{t("clips.connectedSuccess")}</Alert>}
        {callbackResult === "error" && <Alert severity="error">{t("clips.oauthError")}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <Button disabled={busy} onClick={() => void refreshStatus()} sx={{ alignSelf: "flex-start" }}>{t("clips.refreshStatus")}</Button>
        {status && <>
            <Alert severity={status.connected ? "success" : "warning"}>
                {status.connected ? t("clips.connected", { login: status.login ?? status.expectedLogin ?? "" }) : t("clips.disconnected")}
            </Alert>
            {status.connected && <Typography variant="body2">{status.chatConnected ? t("clips.chatConnected", { count: status.subscribedChannels }) : t("clips.chatDisconnected")}</Typography>}
            {!status.jobsEnabled && <Alert severity="warning">{t("clips.jobsDisabled")}</Alert>}
            {status.lastErrorCode && <Alert severity="warning">{t(runtimeErrorKeys[status.lastErrorCode] ?? "clips.runtimeError", { code: status.lastErrorCode })}</Alert>}
            {!status.configured && <Alert severity="info">{t("clips.notConfigured")}</Alert>}
            {isAdmin ? <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Button variant="outlined" disabled={busy || !status.configured} onClick={() => void changeConnection(false)}>{t("clips.connect")}</Button>
                {status.connected && <Button color="error" disabled={busy} onClick={() => void changeConnection(true)}>{t("clips.disconnect")}</Button>}
            </Stack> : <Typography variant="body2" color="text.secondary">{t("clips.operatorHelp")}</Typography>}
        </>}
    </Stack></CardContent></Card>;
}
