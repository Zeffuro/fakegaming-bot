"use client";
import React, { useEffect, useMemo, useState } from "react";
import { AdminPage } from "@/components/AdminPage";
import { api, type RiotLinkEntry } from "@/lib/api-client";
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { Delete, Edit, Refresh } from "@mui/icons-material";

interface EditForm {
    discordId: string;
    summonerName: string;
    region: string;
    puuid: string;
}

function toForm(link: RiotLinkEntry): EditForm {
    return {
        discordId: link.discordId,
        summonerName: link.summonerName,
        region: link.region,
        puuid: link.puuid,
    };
}

function shortPuuid(puuid: string): string {
    if (puuid.length <= 18) return puuid;
    return `${puuid.slice(0, 8)}...${puuid.slice(-8)}`;
}

export default function AdminRiotLinksPage() {
    const [links, setLinks] = useState<RiotLinkEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [editing, setEditing] = useState<EditForm | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.getRiotLinks();
            setLinks(response.links);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load Riot links");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const filteredLinks = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return links;
        return links.filter(link =>
            link.discordId.toLowerCase().includes(needle)
            || link.summonerName.toLowerCase().includes(needle)
            || link.region.toLowerCase().includes(needle)
            || link.puuid.toLowerCase().includes(needle)
        );
    }, [links, query]);

    const saveEdit = async () => {
        if (!editing) return;
        setSaving(true);
        setError(null);
        try {
            const updated = await api.updateRiotLink(editing.discordId, {
                summonerName: editing.summonerName.trim(),
                region: editing.region.trim(),
                puuid: editing.puuid.trim(),
            });
            setLinks(current => {
                const index = current.findIndex(link => link.discordId === updated.discordId);
                if (index === -1) return [updated, ...current];
                return current.map(link => link.discordId === updated.discordId ? updated : link);
            });
            setEditing(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save Riot link");
        } finally {
            setSaving(false);
        }
    };

    const deleteLink = async (link: RiotLinkEntry) => {
        const ok = window.confirm(`Remove Riot link for ${link.summonerName} (${link.discordId})?`);
        if (!ok) return;
        setSaving(true);
        setError(null);
        try {
            await api.deleteRiotLink(link.discordId);
            setLinks(current => current.filter(item => item.discordId !== link.discordId));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete Riot link");
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminPage title="Admin Riot Links" trail={[{ label: "Riot Links", href: "/dashboard/admin/riot-links" }]}>
            <Stack spacing={2}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { xs: "stretch", md: "center" } }}>
                    <TextField
                        label="Search linked accounts"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        fullWidth
                        placeholder="Discord ID, Riot ID, region, or PUUID"
                    />
                    <Button
                        variant="contained"
                        startIcon={<Refresh />}
                        onClick={() => void load()}
                        disabled={loading || saving}
                        sx={{ minWidth: 132 }}
                    >
                        Refresh
                    </Button>
                </Stack>

                {error && <Alert severity="error">{error}</Alert>}

                <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                    <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                        <Typography variant="h6">Linked Riot Accounts</Typography>
                        <Chip size="small" label={`${filteredLinks.length} shown`} />
                    </Box>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Discord User</TableCell>
                                    <TableCell>Riot ID</TableCell>
                                    <TableCell>Region</TableCell>
                                    <TableCell>PUUID</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredLinks.map(link => (
                                    <TableRow key={link.discordId} hover>
                                        <TableCell sx={{ fontFamily: "monospace" }}>{link.discordId}</TableCell>
                                        <TableCell>{link.summonerName}</TableCell>
                                        <TableCell>{link.region}</TableCell>
                                        <TableCell sx={{ fontFamily: "monospace" }}>
                                            <Tooltip title={link.puuid}>
                                                <span>{shortPuuid(link.puuid)}</span>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="Edit Riot link">
                                                <IconButton onClick={() => setEditing(toForm(link))} disabled={saving}>
                                                    <Edit />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Remove Riot link">
                                                <IconButton color="error" onClick={() => void deleteLink(link)} disabled={saving}>
                                                    <Delete />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {!loading && filteredLinks.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography variant="body2" color="text.secondary">
                                                No linked Riot accounts found.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {loading && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography variant="body2" color="text.secondary">
                                                Loading...
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </Stack>

            <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
                <DialogTitle>Edit Riot Link</DialogTitle>
                <DialogContent>
                    {editing && (
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <TextField label="Discord user ID" value={editing.discordId} disabled fullWidth />
                            <TextField
                                label="Riot ID"
                                value={editing.summonerName}
                                onChange={(event) => setEditing({ ...editing, summonerName: event.target.value })}
                                fullWidth
                            />
                            <TextField
                                label="Region"
                                value={editing.region}
                                onChange={(event) => setEditing({ ...editing, region: event.target.value })}
                                fullWidth
                            />
                            <TextField
                                label="PUUID"
                                value={editing.puuid}
                                onChange={(event) => setEditing({ ...editing, puuid: event.target.value })}
                                fullWidth
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
                    <Button onClick={() => void saveEdit()} variant="contained" disabled={saving || !editing?.summonerName.trim() || !editing?.region.trim() || !editing?.puuid.trim()}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminPage>
    );
}
