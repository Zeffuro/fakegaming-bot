"use client";
import React, { useState } from "react";
import { AdminPage } from "@/components/AdminPage";
import { api } from "@/lib/api-client";
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useAsyncTask } from "@/components/hooks/useAsync";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

interface VerifyResult {
    exists: boolean;
    id?: string;
    login?: string;
    displayName?: string;
}

export default function AdminTwitchDebugPage() {
    const { t } = useDashboardI18n();
    const [username, setUsername] = useState<string>("");
    const { submitting, result, error, setError, run } = useAsyncTask<VerifyResult>();

    const handleVerify = async () => {
        const u = username.trim().replace(/^@/, "");
        if (!u) {
            setError(t("admin.twitchUsernameRequired"));
            return;
        }
        await run(async () => {
            const res = await api.verifyTwitchUsername(u);
            return res as VerifyResult;
        });
    };

    return (
        <AdminPage title={t("admin.twitchPageTitle")} trail={[{ label: t("admin.twitchDebug"), href: '/dashboard/admin/twitch' }] }>
            <Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ maxWidth: 700, mb: 2 }}>
                    <TextField
                        label={t("admin.twitchUsername")}
                        placeholder="e.g. twitchdev"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        fullWidth
                    />
                    <Button variant="contained" onClick={() => void handleVerify()} disabled={submitting}>
                        {submitting ? t("admin.verifying") : t("admin.verify")}
                    </Button>
                </Stack>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                )}

                {result && (
                    <Card variant="outlined" sx={{ maxWidth: 700 }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 1 }}>{t("admin.result")}</Typography>
                            <Stack spacing={0.5}>
                                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                                    <Typography variant="body2">{t("admin.exists")}</Typography>
                                    <Typography variant="body2" color={result.exists ? 'success.main' : 'error.main'}>{result.exists ? t("common.yes") : t("common.no")}</Typography>
                                </Stack>
                                {result.id && (
                                    <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                                        <Typography variant="body2">ID</Typography>
                                        <Typography variant="body2">{result.id}</Typography>
                                    </Stack>
                                )}
                                {result.login && (
                                    <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                                        <Typography variant="body2">{t("admin.login")}</Typography>
                                        <Typography variant="body2">{result.login}</Typography>
                                    </Stack>
                                )}
                                {result.displayName && (
                                    <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                                        <Typography variant="body2">{t("admin.displayName")}</Typography>
                                        <Typography variant="body2">{result.displayName}</Typography>
                                    </Stack>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                )}
            </Box>
        </AdminPage>
    );
}
