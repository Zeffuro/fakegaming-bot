"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Divider, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import PushPin from "@mui/icons-material/PushPin";
import { alpha } from "@mui/material/styles";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents, dashboardCardSx, dashboardFieldSx, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import type { UserNote, UserNoteUpdateInput } from "@/lib/api-client";

type NoteStatus = "active" | "all" | "unread" | "read" | "archived";

export function filterInboxNotes(notes: UserNote[], query: string, tag: string, status: NoteStatus) {
    const term = query.trim().normalize("NFKC").toLowerCase();
    return notes.filter(note => {
        const state = note.status ?? "unread";
        if (status === "active" ? state === "archived" : status !== "all" && state !== status) return false;
        if (tag && !(note.tags ?? []).includes(tag)) return false;
        return !term || `${note.title}\n${note.body}`.normalize("NFKC").toLowerCase().includes(term);
    });
}

export function NoteInboxPanel({ notes, saving, onTogglePinned, onEdit, onDelete, onUpdate }: {
    notes: UserNote[];
    saving: boolean;
    onTogglePinned: (note: UserNote) => void | Promise<void>;
    onEdit: (note: UserNote) => void;
    onDelete: (note: UserNote) => void | Promise<void>;
    onUpdate: (id: string, input: UserNoteUpdateInput) => Promise<UserNote>;
}) {
    const { t, formatNumber } = useDashboardI18n();
    const [query, setQuery] = useState("");
    const [tag, setTag] = useState("");
    const [status, setStatus] = useState<NoteStatus>("active");
    const [page, setPage] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const filtered = useMemo(() => filterInboxNotes(notes, query, tag, status), [notes, query, tag, status]);
    const tags = useMemo(() => [...new Set(notes.flatMap(note => note.tags ?? []))].sort(), [notes]);
    useEffect(() => {
        if (tag && !tags.includes(tag)) { setTag(""); setPage(1); }
    }, [tag, tags]);
    const pages = Math.max(1, Math.ceil(filtered.length / 10));
    const currentPage = Math.min(page, pages);
    const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);

    async function update(id: string, input: UserNoteUpdateInput) {
        try {
            await onUpdate(id, input);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : t("hooks.failedToUpdateNote"));
        }
    }

    return <FeaturePanel accent={dashboardAccents.quotes}>
        <Stack spacing={2.25} sx={{ position: "relative" }}>
            <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900 }}>{t("personal.notesTitle")}</Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.56)" }}>{t("personal.notesFiltered", { shown: formatNumber(filtered.length), total: formatNumber(notes.length) })}</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <TextField label={t("personal.searchNotes")} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} size="small" sx={{ flex: 1, ...dashboardFieldSx(dashboardAccents.quotes) }} />
                <TextField select label={t("personal.inboxStatus")} value={status} onChange={event => { setStatus(event.target.value as NoteStatus); setPage(1); }} size="small" sx={{ minWidth: 150, ...dashboardFieldSx(dashboardAccents.quotes) }}>
                    {(["active", "unread", "read", "archived", "all"] as const).map(state => <MenuItem key={state} value={state}>{t(`personal.inbox.${state}`)}</MenuItem>)}
                </TextField>
                <TextField select label={t("personal.inboxTags")} value={tag} onChange={event => { setTag(event.target.value); setPage(1); }} size="small" sx={{ minWidth: 150, ...dashboardFieldSx(dashboardAccents.quotes) }}>
                    <MenuItem value="">{t("personal.inbox.all")}</MenuItem>
                    {tags.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                </TextField>
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
            {visible.length === 0 && <Typography sx={{ color: "grey.300" }}>{t(notes.length ? "personal.noMatchingNotes" : "personal.noNotes")}</Typography>}
            {visible.map(note => <InboxNoteCard key={note.id} note={note} saving={saving} onTogglePinned={onTogglePinned} onEdit={onEdit} onDelete={onDelete} onUpdate={update} />)}
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                <Button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} sx={ghostActionButtonSx(dashboardAccents.quotes)}>{t("personal.inbox.previous")}</Button>
                <Typography sx={{ color: "grey.300" }}>{t("personal.inbox.page", { page: currentPage, pages })}</Typography>
                <Button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)} sx={ghostActionButtonSx(dashboardAccents.quotes)}>{t("personal.inbox.next")}</Button>
            </Stack>
        </Stack>
    </FeaturePanel>;
}

function InboxNoteCard({ note, saving, onTogglePinned, onEdit, onDelete, onUpdate }: {
    note: UserNote;
    saving: boolean;
    onTogglePinned: (note: UserNote) => void | Promise<void>;
    onEdit: (note: UserNote) => void;
    onDelete: (note: UserNote) => void | Promise<void>;
    onUpdate: (id: string, input: UserNoteUpdateInput) => Promise<void>;
}) {
    const { t, formatDate } = useDashboardI18n();
    const [tags, setTags] = useState((note.tags ?? []).join(", "));
    const [invalidTags, setInvalidTags] = useState(false);
    const storedTags = (note.tags ?? []).join(", ");
    useEffect(() => setTags(storedTags), [storedTags]);
    const state = note.status ?? "unread";
    let source: string | null = null;
    try {
        const url = note.sourceUrl ? new URL(note.sourceUrl) : null;
        if (url && ["https:", "http:"].includes(url.protocol) && !url.username && !url.password) source = url.href;
    } catch { source = null; }

    function saveTags() {
        const values = tags.split(",").map(value => value.trim()).filter(Boolean);
        if (values.length > 10 || values.some(value => value.length > 32)) { setInvalidTags(true); return; }
        setInvalidTags(false);
        void onUpdate(note.id, { tags: values });
    }

    return <Box sx={{ ...dashboardCardSx(note.pinned ? dashboardAccents.commands : dashboardAccents.quotes), p: 2.25 }}>
        <Stack spacing={1.5} sx={{ position: "relative" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: "grey.50", fontWeight: 900, overflowWrap: "anywhere" }}>{note.title}</Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1, mt: 1 }}>
                        <Chip label={t(`personal.inbox.${state}`)} size="small" sx={{ color: "grey.50" }} />
                        {note.pinned && <Chip icon={<PushPin fontSize="small" />} label={t("personal.pinned")} size="small" sx={{ bgcolor: alpha(dashboardAccents.commands, 0.16), color: "grey.50" }} />}
                    </Stack>
                    {note.updatedAt && <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.46)" }}>{t("personal.noteUpdated", { date: formatDate(note.updatedAt) })}</Typography>}
                </Box>
                <Stack direction="row" spacing={0.5}>
                    <Tooltip title={note.pinned ? t("personal.unpin") : t("personal.pin")}><IconButton disabled={saving} aria-label={note.pinned ? t("personal.unpinNoteAria") : t("personal.pinNoteAria")} onClick={() => void onTogglePinned(note)} sx={{ color: note.pinned ? dashboardAccents.commands : "grey.300" }}><PushPin fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title={t("common.edit")}><IconButton disabled={saving} aria-label={t("personal.editNoteAria")} onClick={() => onEdit(note)} sx={{ color: "grey.300" }}><Edit fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title={t("common.delete")}><IconButton disabled={saving} aria-label={t("personal.deleteNoteAria")} onClick={() => void onDelete(note)} sx={{ color: dashboardAccents.quotes }}><Delete fontSize="small" /></IconButton></Tooltip>
                </Stack>
            </Stack>
            {note.body && <><Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} /><Typography sx={{ color: "rgba(255,255,255,0.74)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note.body}</Typography></>}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField label={t("personal.inboxTags")} value={tags} onChange={event => setTags(event.target.value)} error={invalidTags} helperText={invalidTags ? t("personal.inbox.invalidTags") : undefined} size="small" sx={{ flex: 1, ...dashboardFieldSx(dashboardAccents.quotes) }} />
                <Button disabled={saving || tags === storedTags} onClick={saveTags} sx={ghostActionButtonSx(dashboardAccents.quotes)}>{t("personal.inbox.saveTags")}</Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                {source && <Button component="a" href={source} target="_blank" rel="noopener noreferrer" onClick={() => { if (state === "unread") void onUpdate(note.id, { status: "read" }); }} sx={ghostActionButtonSx(dashboardAccents.commands)}>{t("personal.inbox.openSource")}</Button>}
                <Button disabled={saving} onClick={() => void onUpdate(note.id, { status: state === "unread" ? "read" : "unread" })} sx={ghostActionButtonSx(dashboardAccents.quotes)}>{t(state === "unread" ? "personal.inbox.markRead" : "personal.inbox.markUnread")}</Button>
                <Button disabled={saving} onClick={() => void onUpdate(note.id, { status: state === "archived" ? "read" : "archived" })} sx={ghostActionButtonSx(dashboardAccents.quotes)}>{t(state === "archived" ? "personal.inbox.restore" : "personal.inbox.archive")}</Button>
            </Stack>
        </Stack>
    </Box>;
}
