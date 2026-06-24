import {
    DEFAULT_AUDIT_EVENTS_LIMIT,
    type AuditEventScope,
    type AuditEventSeverity,
    type AuditEventStatus,
    type AuditEventsQuery,
    type AuditIntegrationProvider,
} from "@/lib/api/audit";

export interface SearchParamsReader {
    get: (name: string) => string | null;
}

export const adminAuditFilterKeys = [
    "action",
    "scope",
    "provider",
    "targetType",
    "actorId",
    "guildId",
    "severity",
    "status",
] as const satisfies Array<keyof AuditEventsQuery>;

const auditScopes = new Set<AuditEventScope>(["integrations"]);
const auditProviders = new Set<AuditIntegrationProvider>(["anime", "bluesky", "patchnotes", "tiktok", "twitch", "youtube"]);
const auditSeverities = new Set<AuditEventSeverity>(["info", "warn", "error"]);
const auditStatuses = new Set<AuditEventStatus>(["success", "failure"]);
const auditLimits = new Set([25, 50, 100, 200]);

export function createDefaultAdminAuditFilters(): AuditEventsQuery {
    return {
        limit: DEFAULT_AUDIT_EVENTS_LIMIT,
        offset: 0,
    };
}

export function parseAdminAuditFilters(params: SearchParamsReader): AuditEventsQuery {
    const filters = createDefaultAdminAuditFilters();
    const action = readTextParam(params, "action");
    const targetType = readTextParam(params, "targetType");
    const actorId = readTextParam(params, "actorId");
    const guildId = readTextParam(params, "guildId");
    const scope = readUnionParam(params, "scope", auditScopes);
    const provider = readUnionParam(params, "provider", auditProviders);
    const severity = readUnionParam(params, "severity", auditSeverities);
    const status = readUnionParam(params, "status", auditStatuses);
    const limit = readLimitParam(params);
    const offset = readOffsetParam(params);

    if (action) filters.action = action;
    if (targetType) filters.targetType = targetType;
    if (actorId) filters.actorId = actorId;
    if (guildId) filters.guildId = guildId;
    if (scope) filters.scope = scope;
    if (provider) {
        filters.provider = provider;
        filters.scope = "integrations";
    }
    if (severity) filters.severity = severity;
    if (status) filters.status = status;
    filters.limit = limit;
    filters.offset = offset;

    return filters;
}

export function serializeAdminAuditFilters(filters: AuditEventsQuery): string {
    const params = new URLSearchParams();
    setTextParam(params, "action", filters.action);
    setTextParam(params, "targetType", filters.targetType);
    setTextParam(params, "actorId", filters.actorId);
    setTextParam(params, "guildId", filters.guildId);
    if (filters.scope) params.set("scope", filters.scope);
    if (filters.provider) params.set("provider", filters.provider);
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.status) params.set("status", filters.status);

    const limit = filters.limit ?? DEFAULT_AUDIT_EVENTS_LIMIT;
    const offset = filters.offset ?? 0;
    if (limit !== DEFAULT_AUDIT_EVENTS_LIMIT) params.set("limit", String(limit));
    if (offset > 0) params.set("offset", String(offset));

    return params.toString();
}

export function countAdminAuditFilters(filters: AuditEventsQuery): number {
    return adminAuditFilterKeys.filter(key => filters[key] !== undefined && filters[key] !== "").length;
}

function readTextParam(params: SearchParamsReader, key: string): string | undefined {
    const value = params.get(key)?.trim();
    return value ? value : undefined;
}

function readUnionParam<T extends string>(params: SearchParamsReader, key: string, allowed: Set<T>): T | undefined {
    const value = readTextParam(params, key)?.toLowerCase();
    if (!value) return undefined;
    return allowed.has(value as T) ? value as T : undefined;
}

function readLimitParam(params: SearchParamsReader): number {
    const value = Number.parseInt(params.get("limit") ?? "", 10);
    return auditLimits.has(value) ? value : DEFAULT_AUDIT_EVENTS_LIMIT;
}

function readOffsetParam(params: SearchParamsReader): number {
    const value = Number.parseInt(params.get("offset") ?? "", 10);
    if (!Number.isInteger(value) || value < 0) return 0;
    return value;
}

function setTextParam(params: URLSearchParams, key: string, value: string | undefined): void {
    const trimmed = value?.trim();
    if (trimmed) params.set(key, trimmed);
}
