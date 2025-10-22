"use client";
import React, { useState } from "react";
import { AdminPage } from "@/components/AdminPage";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { api } from "@/lib/api-client";

export default function AdminTikTokDebugPage() {
    const [username, setUsername] = useState<string>("");
    const [isLive, setIsLive] = useState<boolean | null>(null);
    const [details, setDetails] = useState<{ roomId: string | null; title: string | null; startedAt: number | null; viewers: number | null; cover: string | null } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [debug, setDebug] = useState<boolean>(false);
    const [debugMeta, setDebugMeta] = useState<{ method: 'fetchIsLive' | 'getRoomInfo' | 'connect' | 'unknown'; raw?: unknown } | null>(null);

    const onCheck = async () => {
        setError(null);
        setIsLive(null);
        setDetails(null);
        setDebugMeta(null);
        const u = username.trim().replace(/^@/, "");
        if (!u) { setError("Please enter a TikTok username"); return; }
        setLoading(true);
        try {
            const res = await api.getTikTokLive(u, debug);
            setIsLive(Boolean(res?.live));
            setDetails({ roomId: res.roomId ?? null, title: res.title ?? null, startedAt: res.startedAt ?? null, viewers: res.viewers ?? null, cover: res.cover ?? null });
            setDebugMeta((res as any).debugMeta ?? null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Request failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AdminPage title="Admin · TikTok Live" trail={[{ label: 'TikTok Live', href: '/dashboard/admin/tiktok' }]}>
            <Box sx={{ maxWidth: 700 }}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    This tool checks whether a TikTok user is currently live.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ maxWidth: 700, mb: 2 }}>
                    <TextField
                        label="TikTok username"
                        placeholder="e.g. creator123"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        fullWidth
                    />
                    <Button variant="contained" onClick={() => void onCheck()} disabled={loading}>
                        {loading ? 'Checking…' : 'Check Live'}
                    </Button>
                </Stack>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <input id="tiktok-debug" type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
                    <label htmlFor="tiktok-debug">Include debug payload</label>
                </Box>
                {error && (<Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>)}
                {isLive !== null && (
                    <Alert severity={isLive ? 'success' : 'info'} sx={{ mb: 2 }}>
                        {isLive ? 'Live now' : 'Not live'}
                    </Alert>
                )}
                {isLive && (
                    <Box sx={{ maxWidth: 700 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            Watch: <a href={`https://www.tiktok.com/@${username.trim().replace(/^@/, '')}/live`} target="_blank" rel="noreferrer">tiktok.com/@{username.trim().replace(/^@/, '')}/live</a>
                        </Typography>
                        {details ? (
                            <Stack spacing={0.5}>
                                <Typography variant="body2">Title: {details.title ?? '—'}</Typography>
                                <Typography variant="body2">Viewers: {typeof details.viewers === 'number' ? details.viewers : '—'}</Typography>
                                <Typography variant="body2">Room ID: {details.roomId ?? '—'}</Typography>
                                <Typography variant="body2">Started: {typeof details.startedAt === 'number' ? new Date(details.startedAt).toLocaleString() : '—'}</Typography>
                                {details.cover ? (
                                    <Box sx={{ mt: 1 }}>
                                        <img src={details.cover} alt="cover" style={{ maxWidth: '100%', borderRadius: 6 }} />
                                    </Box>
                                ) : (
                                    <Typography variant="body2">Cover: —</Typography>
                                )}
                                {(!details.title && !details.roomId && typeof details.viewers !== 'number' && typeof details.startedAt !== 'number' && !details.cover) && (
                                    <Alert severity="info" sx={{ mt: 1 }}>
                                        No extra details available from connector for this stream.
                                    </Alert>
                                )}
                            </Stack>
                        ) : (
                            <Alert severity="info">No details object returned</Alert>
                        )}
                    </Box>
                )}
                {/* debug meta (if present) - show regardless of live */}
                {debug && debugMeta && (
                    <Box sx={{ mt: 2, maxWidth: 700 }}>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>Debug method: {debugMeta.method}</Typography>
                        {typeof debugMeta.raw !== 'undefined' && (
                            <Box component="pre" sx={{
                                p: 1.5,
                                borderRadius: 1,
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0f172a' : '#f3f4f6',
                                color: (theme) => theme.palette.mode === 'dark' ? '#e5e7eb' : '#111827',
                                border: '1px solid',
                                borderColor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.300',
                                overflow: 'auto',
                                maxHeight: 360,
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                fontSize: '0.8rem',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}>
                                {(() => {
                                    try { return JSON.stringify(debugMeta.raw, null, 2); } catch { return String(debugMeta.raw); }
                                })()}
                            </Box>
                        )}
                    </Box>
                )}
            </Box>
        </AdminPage>
    );
}
