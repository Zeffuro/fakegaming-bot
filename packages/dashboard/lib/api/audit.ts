import { apiRequest } from "./core";

const AUDIT_EVENTS_ENDPOINT = "/api/external/auditEvents";

export const DEFAULT_AUDIT_EVENTS_LIMIT = 50;

export type AuditEventSeverity = "info" | "warn" | "error";
export type AuditEventStatus = "success" | "failure";
export type AuditEventScope = "integrations";
export type AuditIntegrationProvider = "anime" | "bluesky" | "patchnotes" | "tiktok" | "twitch" | "youtube";

export interface AuditEventEntry {
    id: number;
    timestamp: string;
    actorId: string | null;
    actorType: "user" | "service" | "system";
    action: string;
    targetType: string;
    targetId: string | null;
    guildId: string | null;
    severity: AuditEventSeverity;
    status: AuditEventStatus;
    requestId: string | null;
    metadata: Record<string, unknown> | null;
}

export interface AuditEventsResponse {
    events: AuditEventEntry[];
    total: number;
    limit: number;
    offset: number;
}

export interface AuditEventsQuery {
    limit?: number;
    offset?: number;
    action?: string;
    scope?: AuditEventScope;
    provider?: AuditIntegrationProvider;
    targetType?: string;
    actorId?: string;
    guildId?: string;
    severity?: AuditEventSeverity;
    status?: AuditEventStatus;
}

export function getAuditEvents(query: AuditEventsQuery = {}): Promise<AuditEventsResponse> {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
            searchParams.set(key, String(value));
        }
    }

    const queryString = searchParams.toString();
    const suffix = queryString.length > 0 ? `?${queryString}` : "";
    return apiRequest<AuditEventsResponse>(`${AUDIT_EVENTS_ENDPOINT}${suffix}`);
}
