"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ErrorOutlined } from "@mui/icons-material";
import { AdminPage } from "@/components/AdminPage";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import { AuditEventFilters } from "@/components/admin/audit/AuditEventFilters";
import { AuditEventsList } from "@/components/admin/audit/AuditEventsList";
import {
    DEFAULT_AUDIT_EVENTS_LIMIT,
    getAuditEvents,
    type AuditEventEntry,
    type AuditEventsQuery,
} from "@/lib/api/audit";

const FILTER_KEYS: Array<keyof AuditEventsQuery> = [
    "action",
    "targetType",
    "actorId",
    "guildId",
    "severity",
    "status",
];

export default function AdminAuditPage() {
    const [filters, setFilters] = useState<AuditEventsQuery>({ limit: DEFAULT_AUDIT_EVENTS_LIMIT, offset: 0 });
    const [events, setEvents] = useState<AuditEventEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? DEFAULT_AUDIT_EVENTS_LIMIT;
    const canGoBack = offset > 0;
    const canGoNext = offset + limit < total;

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

    const updateFilter = useCallback(<K extends keyof AuditEventsQuery>(key: K, value: AuditEventsQuery[K] | undefined) => {
        setFilters(current => ({
            ...current,
            [key]: value,
            offset: 0,
        }));
    }, []);

    const clearFilters = () => {
        setFilters({ limit: DEFAULT_AUDIT_EVENTS_LIMIT, offset: 0 });
    };

    const activeFilterCount = useMemo(() => {
        return FILTER_KEYS.filter(key => filters[key] !== undefined && filters[key] !== "").length;
    }, [filters]);

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
                    onLimitChange={(nextLimit) => updateFilter("limit", nextLimit)}
                    onPrevious={() => setFilters(current => ({ ...current, offset: Math.max(0, (current.offset ?? 0) - limit) }))}
                    onNext={() => setFilters(current => ({ ...current, offset: (current.offset ?? 0) + limit }))}
                />
            </Stack>
        </AdminPage>
    );
}