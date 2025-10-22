"use client";
import React, { useState } from "react";
import { AdminPage } from "@/components/AdminPage";
import { api } from "@/lib/api-client";
import { Alert, Box, Button, Card, CardContent, Divider, Link, Stack, TextField, Typography } from "@mui/material";
import { useAsyncTask } from "@/components/hooks/useAsync";

export default function AdminYouTubeDebugPage() {
    const [identifier, setIdentifier] = useState<string>("");
    const { submitting, result, error, setError, run } = useAsyncTask<{ channelId: string | null }>();

    const handleResolve = async () => {
        const id = identifier.trim();
        if (!id) {
            setError("Please enter a YouTube identifier (handle/username/UC-Id)");
            return;
        }
        await run(async () => {
            const res = await api.resolveYouTubeIdentifier(id);
            return { channelId: res.channelId ?? null };
        });
    };

    const channelId = result?.channelId ?? null;

    return (
        <AdminPage title="Admin · YouTube Debug" trail={[{ label: 'YouTube Debug', href: '/dashboard/admin/youtube' }] }>
            <Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ maxWidth: 700, mb: 2 }}>
                    <TextField
                        label="YouTube identifier"
                        placeholder="e.g. @GoogleDevelopers or GoogleDevelopers or UC..."
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        fullWidth
                    />
                    <Button variant="contained" onClick={() => void handleResolve()} disabled={submitting}>
                        {submitting ? 'Resolving…' : 'Resolve'}
                    </Button>
                </Stack>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                )}

                {channelId !== null && (
                    <Card variant="outlined" sx={{ maxWidth: 700 }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 1 }}>Result</Typography>
                            <Stack spacing={0.5}>
                                <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="body2">Channel ID</Typography>
                                    <Typography variant="body2">{channelId ?? 'null'}</Typography>
                                </Stack>
                            </Stack>
                            {channelId && (
                                <>
                                    <Divider sx={{ my: 1 }} />
                                    <Typography variant="body2">
                                        Open channel: <Link href={`https://www.youtube.com/channel/${channelId}`} target="_blank" rel="noreferrer">youtube.com/channel/{channelId}</Link>
                                    </Typography>
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}
            </Box>
        </AdminPage>
    );
}
