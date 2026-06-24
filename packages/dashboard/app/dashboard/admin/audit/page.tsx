"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ErrorOutlined } from "@mui/icons-material";
import { AdminPage } from "@/components/AdminPage";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import { AuditEventFilters } from "@/components/admin/audit/AuditEventFilters";
import { AuditEventDetailDialog } from "@/components/admin/audit/AuditEventDetailDialog";
import { AuditEventsList } from "@/components/admin/audit/AuditEventsList";
import { AdminSavedViews, type AdminSavedViewPreset } from "@/components/admin/AdminSavedViews";
import {
    DEFAULT_AUDIT_EVENTS_LIMIT,
    getAuditEvents,
    type AuditEventEntry,
    type AuditEventsQuery,
} from "@/lib/api/audit";
import {
    countAdminAuditFilters,
    createDefaultAdminAuditFilters,
    parseAdminAuditFilters,
    serializeAdminAuditFilters,
} from "@/lib/adminAuditFilters";
import { adminAuditCsvHeaders, buildAdminAuditCsvRows } from "@/lib/adminAnalyticsExports";
import { createCsvFilename, downloadCsv } from "@/lib/csvExport";

const auditSavedViewPresets: AdminSavedViewPreset[] = [
    { id: "audit:failed", label: "Failed events", query: "status=failure" },
    { id: "audit:error", label: "Error failures", query: "severity=error&status=failure" },
    { id: "audit:integrations", label: "Integration failures", query: "scope=integrations&status=failure" },
];

function AdminAuditContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const searchParamString = searchParams?.toString() ?? "";
    const [filters, setFilters] = useState<AuditEventsQuery>(() => parseAdminAuditFilters(new URLSearchParams(searchParamString)));
    const [events, setEvents] = useState<AuditEventEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<AuditEventEntry | null>(null);

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? DEFAULT_AUDIT_EVENTS_LIMIT;
    const canGoBack = offset > 0;
    const canGoNext = offset + limit < total;

    useEffect(() => {
        setFilters(parseAdminAuditFilters(new URLSearchParams(searchParamString)));
    }, [searchParamString]);

    const loadEvents = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getAuditEvents(filters);
            setEvents(response.events);
            setTotal(response.total);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load audit events");
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        void loadEvents();
    }, [loadEvents]);

    const commitFilters = useCallback((nextFilters: AuditEventsQuery) => {
        setFilters(nextFilters);
        const query = serializeAdminAuditFilters(nextFilters);
        router.replace(query ? `/dashboard/admin/audit?${query}` : "/dashboard/admin/audit", { scroll: false });
    }, [router]);

    const updateFilter = useCallback(<K extends keyof AuditEventsQuery>(key: K, value: AuditEventsQuery[K] | undefined) => {
        const nextFilters: AuditEventsQuery = {
            ...filters,
            [key]: value,
            offset: 0,
        };
        if (value === undefined || value === "") delete nextFilters[key];
        if (key === "provider" && value) nextFilters.scope = "integrations";
        if (key === "scope" && !value) delete nextFilters.provider;
        commitFilters(nextFilters);
    }, [commitFilters, filters]);

    const clearFilters = () => {
        commitFilters(createDefaultAdminAuditFilters());
    };

    const activeFilterCount = useMemo(() => {
        return countAdminAuditFilters(filters);
    }, [filters]);
    const savedViewQuery = useMemo(() => serializeAdminAuditFilters(filters), [filters]);
    const exportEvents = useCallback(() => {
        downloadCsv(
            createCsvFilename("admin-audit-events"),
            adminAuditCsvHeaders,
            buildAdminAuditCsvRows(events),
        );
    }, [events]);

    return (
        <AdminPage title="Audit Events" trail={[{ label: "Audit Events", href: "/dashboard/admin/audit" }]}>
            <Stack spacing={2.5}>
                <AuditEventFilters
                    filters={filters}
                    loading={loading}
                    activeFilterCount={activeFilterCount}
                    onRefresh={() => void loadEvents()}
                    onClear={clearFilters}
                    onUpdateFilter={updateFilter}
                />

                <AdminSavedViews
                    scope="audit"
                    basePath="/dashboard/admin/audit"
                    currentQuery={savedViewQuery}
                    defaultLabel={activeFilterCount > 0 ? `${activeFilterCount} audit filters` : "Audit view"}
                    presets={auditSavedViewPresets}
                />

                {error && (
                    <Alert severity="error" icon={<ErrorOutlined />} sx={{ bgcolor: alpha(dashboardAccents.quotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.quotes, 0.22)}` }}>
                        {error}
                    </Alert>
                )}

                <AuditEventsList
                    events={events}
                    total={total}
                    limit={limit}
                    loading={loading}
                    canGoBack={canGoBack}
                    canGoNext={canGoNext}
                    onLimitChange={(nextLimit) => commitFilters({ ...filters, limit: nextLimit, offset: 0 })}
                    onPrevious={() => commitFilters({ ...filters, offset: Math.max(0, offset - limit) })}
                    onNext={() => commitFilters({ ...filters, offset: offset + limit })}
                    onExport={exportEvents}
                    onInspectEvent={setSelectedEvent}
                />
                <AuditEventDetailDialog
                    event={selectedEvent}
                    open={selectedEvent !== null}
                    onClose={() => setSelectedEvent(null)}
                />
            </Stack>
        </AdminPage>
    );
}

export default function AdminAuditPage() {
    return (
        <Suspense fallback={<AdminPage title="Audit Events"><Typography>Loading audit events...</Typography></AdminPage>}>
            <AdminAuditContent />
        </Suspense>
    );
}
