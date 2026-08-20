"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

interface EditForm {
    discordId: string;
    summonerName: string;
    riotIdGameName: string;
    riotIdTagLine: string;
    region: string;
    puuid: string;
}

function parseRiotId(value: string): Pick<EditForm, "riotIdGameName" | "riotIdTagLine"> {
    const trimmed = value.trim();
    const separatorIndex = trimmed.indexOf("#");
    if (separatorIndex === -1) {
        return { riotIdGameName: trimmed, riotIdTagLine: "" };
    }

    return {
        riotIdGameName: trimmed.slice(0, separatorIndex).trim(),
        riotIdTagLine: trimmed.slice(separatorIndex + 1).trim(),
    };
}

function displayRiotId(link: Pick<RiotLinkEntry, "summonerName" | "riotIdGameName" | "riotIdTagLine">): string {
    const gameName = link.riotIdGameName?.trim();
    const tagLine = link.riotIdTagLine?.trim();
    if (gameName && tagLine) return `${gameName}#${tagLine}`;
    return link.summonerName;
}

function toForm(link: RiotLinkEntry): EditForm {
    const parsed = parseRiotId(link.summonerName);
    return {
        discordId: link.discordId,
        summonerName: link.summonerName,
        riotIdGameName: link.riotIdGameName ?? parsed.riotIdGameName,
        riotIdTagLine: link.riotIdTagLine ?? parsed.riotIdTagLine,
        region: link.region,
        puuid: link.puuid,
    };
}

function shortPuuid(puuid: string): string {
    if (puuid.length <= 18) return puuid;
    return `${puuid.slice(0, 8)}...${puuid.slice(-8)}`;
}

export default function AdminRiotLinksPage() {
    const { t, formatNumber } = useDashboardI18n();
    const [links, setLinks] = useState<RiotLinkEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [editing, setEditing] = useState<EditForm | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.getRiotLinks();
            setLinks(response.links);
        } catch (err) {
            setError(err instanceof Error ? err.message : t("admin.riotLinksLoadFailed"));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void load();
    }, [load]);

    const filteredLinks = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return links;
        return links.filter(link =>
            link.discordId.toLowerCase().includes(needle)
            || displayRiotId(link).toLowerCase().includes(needle)
            || (link.riotIdGameName?.toLowerCase().includes(needle) ?? false)
            || (link.riotIdTagLine?.toLowerCase().includes(needle) ?? false)
            || link.region.toLowerCase().includes(needle)
            || link.puuid.toLowerCase().includes(needle)
        );
    }, [links, query]);

    const saveEdit = async () => {
        if (!editing) return;
        setSaving(true);
        setError(null);
        try {
            const riotIdGameName = editing.riotIdGameName.trim() || null;
            const riotIdTagLine = editing.riotIdTagLine.trim() || null;
            const summonerName = riotIdGameName && riotIdTagLine
                ? `${riotIdGameName}#${riotIdTagLine}`
                : editing.summonerName.trim();
            const updated = await api.updateRiotLink(editing.discordId, {
                summonerName,
                riotIdGameName,
                riotIdTagLine,
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
            setError(err instanceof Error ? err.message : t("admin.riotLinksSaveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const deleteLink = async (link: RiotLinkEntry) => {
        const ok = window.confirm(t("admin.riotLinksConfirmDelete", {
            riotId: displayRiotId(link),
            discordId: link.discordId,
        }));
        if (!ok) return;
        setSaving(true);
        setError(null);
        try {
            await api.deleteRiotLink(link.discordId);
            setLinks(current => current.filter(item => item.discordId !== link.discordId));
        } catch (err) {
            setError(err instanceof Error ? err.message : t("admin.riotLinksDeleteFailed"));
        } finally {
            setSaving(false);
        }
    };

    const canSaveEdit = !!editing
        && !!(editing.summonerName.trim() || (editing.riotIdGameName.trim() && editing.riotIdTagLine.trim()))
        && !!editing.region.trim()
        && !!editing.puuid.trim();

    return (
        <AdminPage title={t("admin.riotLinksPageTitle")} trail={[{ label: t("admin.riotLinks"), href: "/dashboard/admin/riot-links" }]}>
            <Stack spacing={2}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { xs: "stretch", md: "center" } }}>
                    <TextField
                        label={t("admin.riotLinksSearch")}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        fullWidth
                        placeholder={t("admin.riotLinksSearchPlaceholder")}
                    />
                    <Button
                        variant="contained"
                        startIcon={<Refresh />}
                        onClick={() => void load()}
                        disabled={loading || saving}
                        sx={{ minWidth: 132 }}
                    >
                        {t("common.refresh")}
                    </Button>
                </Stack>

                {error && <Alert severity="error">{error}</Alert>}

                <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                    <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                        <Typography variant="h6">{t("admin.riotLinksAccounts")}</Typography>
                        <Chip size="small" label={t("admin.riotLinksShown", { count: formatNumber(filteredLinks.length) })} />
                    </Box>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t("admin.riotLinksDiscordUser")}</TableCell>
                                    <TableCell>{t("admin.riotLinksRiotId")}</TableCell>
                                    <TableCell>{t("admin.riotLinksRegion")}</TableCell>
                                    <TableCell>PUUID</TableCell>
                                    <TableCell align="right">{t("admin.riotLinksActions")}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredLinks.map(link => (
                                    <TableRow key={link.discordId} hover>
                                        <TableCell sx={{ fontFamily: "monospace" }}>{link.discordId}</TableCell>
                                        <TableCell>{displayRiotId(link)}</TableCell>
                                        <TableCell>{link.region}</TableCell>
                                        <TableCell sx={{ fontFamily: "monospace" }}>
                                            <Tooltip title={link.puuid}>
                                                <span>{shortPuuid(link.puuid)}</span>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title={t("admin.riotLinksEdit")}>
                                                <IconButton onClick={() => setEditing(toForm(link))} disabled={saving}>
                                                    <Edit />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={t("admin.riotLinksRemove")}>
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
                                                {t("admin.riotLinksEmpty")}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {loading && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t("common.loading")}
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
                <DialogTitle>{t("admin.riotLinksEditTitle")}</DialogTitle>
                <DialogContent>
                    {editing && (
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <TextField label={t("admin.riotLinksDiscordUserId")} value={editing.discordId} disabled fullWidth />
                            <TextField
                                label={t("admin.riotLinksRiotId")}
                                value={editing.summonerName}
                                onChange={(event) => setEditing({ ...editing, summonerName: event.target.value })}
                                fullWidth
                            />
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                <TextField
                                    label={t("admin.riotLinksGameName")}
                                    value={editing.riotIdGameName}
                                    onChange={(event) => setEditing({ ...editing, riotIdGameName: event.target.value })}
                                    fullWidth
                                />
                                <TextField
                                    label={t("admin.riotLinksTagLine")}
                                    value={editing.riotIdTagLine}
                                    onChange={(event) => setEditing({ ...editing, riotIdTagLine: event.target.value })}
                                    fullWidth
                                />
                            </Stack>
                            <TextField
                                label={t("admin.riotLinksRegion")}
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
                    <Button onClick={() => setEditing(null)} disabled={saving}>{t("common.cancel")}</Button>
                    <Button onClick={() => void saveEdit()} variant="contained" disabled={saving || !canSaveEdit}>
                        {t("common.save")}
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminPage>
    );
}
