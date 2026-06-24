"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { BookmarkAdd, PushPin } from "@mui/icons-material";
import { dashboardAccents, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import {
    adminSavedViewsStorageKey,
    buildAdminSavedViewHref,
    createAdminSavedView,
    getAdminSavedViewsForScope,
    normalizeSavedViewQuery,
    parseAdminSavedViews,
    removeAdminSavedView,
    serializeAdminSavedViews,
    upsertAdminSavedView,
    type AdminSavedView,
    type AdminSavedViewScope,
} from "@/lib/adminSavedViews";

export interface AdminSavedViewPreset {
    id: string;
    label: string;
    query: string;
}

export function AdminSavedViews({
    scope,
    basePath,
    currentQuery,
    defaultLabel,
    presets,
}: {
    scope: AdminSavedViewScope;
    basePath: string;
    currentQuery: string;
    defaultLabel: string;
    presets: AdminSavedViewPreset[];
}) {
    const [views, setViews] = useState<AdminSavedView[]>([]);
    const accent = dashboardAccents.admin;
    const normalizedCurrentQuery = useMemo(() => normalizeSavedViewQuery(currentQuery), [currentQuery]);
    const scopedViews = useMemo(() => getAdminSavedViewsForScope(views, scope), [scope, views]);

    useEffect(() => {
        setViews(parseAdminSavedViews(window.localStorage.getItem(adminSavedViewsStorageKey)));
    }, []);

    const persistViews = useCallback((nextViews: AdminSavedView[]) => {
        setViews(nextViews);
        window.localStorage.setItem(adminSavedViewsStorageKey, serializeAdminSavedViews(nextViews));
    }, []);

    const saveCurrentView = useCallback(() => {
        if (!normalizedCurrentQuery) return;
        const label = window.prompt("Saved view name", defaultLabel);
        if (!label) return;

        const view = createAdminSavedView({
            scope,
            label,
            query: normalizedCurrentQuery,
        });
        if (!view) return;

        persistViews(upsertAdminSavedView(views, view));
    }, [defaultLabel, normalizedCurrentQuery, persistViews, scope, views]);

    const deleteView = useCallback((id: string) => {
        persistViews(removeAdminSavedView(views, id));
    }, [persistViews, views]);

    return (
        <Box sx={{ borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", p: 1.35 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.1} sx={{ alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", gap: 1.2 }}>
                <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", minWidth: 0 }}>
                    <PushPin sx={{ color: accent, fontSize: 18 }} />
                    <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 850 }}>
                        Saved views
                    </Typography>
                </Stack>

                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
                    {presets.map((preset) => (
                        <SavedViewChip
                            key={preset.id}
                            label={preset.label}
                            href={buildAdminSavedViewHref(basePath, preset.query)}
                            accent={accent}
                            pinned
                        />
                    ))}
                    {scopedViews.map((view) => (
                        <SavedViewChip
                            key={view.id}
                            label={view.label}
                            href={buildAdminSavedViewHref(basePath, view.query)}
                            accent={accent}
                            onDelete={() => deleteView(view.id)}
                        />
                    ))}
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<BookmarkAdd />}
                        disabled={!normalizedCurrentQuery}
                        onClick={saveCurrentView}
                        sx={ghostActionButtonSx(accent)}
                    >
                        Save view
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}

function SavedViewChip({
    label,
    href,
    accent,
    pinned,
    onDelete,
}: {
    label: string;
    href: string;
    accent: string;
    pinned?: boolean;
    onDelete?: () => void;
}) {
    return (
        <Chip
            component={Link}
            href={href}
            clickable
            size="small"
            icon={pinned ? <PushPin /> : undefined}
            label={label}
            onDelete={onDelete}
            sx={{
                bgcolor: alpha(accent, pinned ? 0.16 : 0.09),
                color: "grey.100",
                border: `1px solid ${alpha(accent, pinned ? 0.34 : 0.22)}`,
                maxWidth: 220,
                "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
                "& .MuiChip-icon": { color: accent },
                "& .MuiChip-deleteIcon": { color: alpha("#fff", 0.58), "&:hover": { color: "grey.100" } },
            }}
        />
    );
}
