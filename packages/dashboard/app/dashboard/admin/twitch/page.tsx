"use client";
import React, { useState } from "react";
import { AdminPage } from "@/components/AdminPage";
import { api } from "@/lib/api-client";
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useAsyncTask } from "@/components/hooks/useAsync";

interface VerifyResult {
    exists: boolean;
    id?: string;
    login?: string;
    displayName?: string;
}

export default function AdminTwitchDebugPage() {
    const [username, setUsername] = useState<string>("");
    const { submitting, result, error, setError, run } = useAsyncTask<VerifyResult>();

    const handleVerify = async () => {
        const u = username.trim().replace(/^@/, "");
        if (!u) {
            setError("Please enter a Twitch username");
            return;
        }
        await run(async () => {
            const res = await api.verifyTwitchUsername(u);
            return res as VerifyResult;
        });
    };

    return (
        <AdminPage title="Admin · Twitch Debug" trail={[{ label: 'Twitch Debug', href: '/dashboard/admin/twitch' }] }>
            <Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ maxWidth: 700, mb: 2 }}>
                    <TextField
                        label="Twitch username"
                        placeholder="e.g. twitchdev"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        fullWidth
                    />
                    <Button variant="contained" onClick={() => void handleVerify()} disabled={submitting}>
                        {submitting ? 'Verifying…' : 'Verify'}
                    </Button>
                </Stack>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                )}

                {result && (
                    <Card variant="outlined" sx={{ maxWidth: 700 }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 1 }}>Result</Typography>
                            <Stack spacing={0.5}>
                                <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="body2">Exists</Typography>
                                    <Typography variant="body2" color={result.exists ? 'success.main' : 'error.main'}>{String(result.exists)}</Typography>
                                </Stack>
                                {result.id && (
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="body2">ID</Typography>
                                        <Typography variant="body2">{result.id}</Typography>
                                    </Stack>
                                )}
                                {result.login && (
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="body2">Login</Typography>
                                        <Typography variant="body2">{result.login}</Typography>
                                    </Stack>
                                )}
                                {result.displayName && (
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="body2">Display Name</Typography>
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
