export type AdminSavedViewScope = "audit" | "integration-health" | "jobs";

export interface AdminSavedView {
    id: string;
    scope: AdminSavedViewScope;
    label: string;
    query: string;
    createdAt: string;
}

export interface AdminSavedViewInput {
    id?: string;
    scope: AdminSavedViewScope;
    label: string;
    query: string;
    createdAt?: string;
}

const maxSavedViewsPerScope = 12;
const maxLabelLength = 48;
const storageVersion = 1;

export const adminSavedViewsStorageKey = "fakegaming:admin-saved-views:v1";

interface StoredAdminSavedViews {
    version: number;
    views: AdminSavedView[];
}

export function createAdminSavedView(input: AdminSavedViewInput): AdminSavedView | null {
    const label = normalizeSavedViewLabel(input.label);
    const query = normalizeSavedViewQuery(input.query);
    if (!label || !query) return null;

    return {
        id: input.id ?? createSavedViewId(input.scope),
        scope: input.scope,
        label,
        query,
        createdAt: input.createdAt ?? new Date().toISOString(),
    };
}

export function parseAdminSavedViews(raw: string | null): AdminSavedView[] {
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw) as Partial<StoredAdminSavedViews>;
        if (parsed.version !== storageVersion || !Array.isArray(parsed.views)) return [];
        return parsed.views
            .map(normalizeStoredSavedView)
            .filter((view): view is AdminSavedView => view !== null);
    } catch {
        return [];
    }
}

export function serializeAdminSavedViews(views: AdminSavedView[]): string {
    const payload: StoredAdminSavedViews = {
        version: storageVersion,
        views: views
            .map(normalizeStoredSavedView)
            .filter((view): view is AdminSavedView => view !== null),
    };
    return JSON.stringify(payload);
}

export function getAdminSavedViewsForScope(views: AdminSavedView[], scope: AdminSavedViewScope): AdminSavedView[] {
    return views
        .filter(view => view.scope === scope)
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function upsertAdminSavedView(views: AdminSavedView[], view: AdminSavedView): AdminSavedView[] {
    const withoutDuplicate = views.filter(item => item.id !== view.id && !(item.scope === view.scope && item.query === view.query));
    const scopedViews = [view, ...withoutDuplicate.filter(item => item.scope === view.scope)]
        .slice(0, maxSavedViewsPerScope);
    return [
        ...scopedViews,
        ...withoutDuplicate.filter(item => item.scope !== view.scope),
    ];
}

export function removeAdminSavedView(views: AdminSavedView[], id: string): AdminSavedView[] {
    return views.filter(view => view.id !== id);
}

export function normalizeSavedViewQuery(query: string): string {
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    params.delete("offset");

    const normalized = new URLSearchParams();
    const entries = [...params.entries()]
        .map(([key, value]) => [key.trim(), value.trim()] as const)
        .filter(([key, value]) => key.length > 0 && value.length > 0)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

    for (const [key, value] of entries) {
        normalized.append(key, value);
    }

    return normalized.toString();
}

export function buildAdminSavedViewHref(basePath: string, query: string): string {
    const normalized = normalizeSavedViewQuery(query);
    return normalized ? `${basePath}?${normalized}` : basePath;
}

function normalizeStoredSavedView(value: unknown): AdminSavedView | null {
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<AdminSavedView>;
    if (!isSavedViewScope(candidate.scope)) return null;

    return createAdminSavedView({
        id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : undefined,
        scope: candidate.scope,
        label: typeof candidate.label === "string" ? candidate.label : "",
        query: typeof candidate.query === "string" ? candidate.query : "",
        createdAt: typeof candidate.createdAt === "string" && candidate.createdAt.trim() ? candidate.createdAt : undefined,
    });
}

function normalizeSavedViewLabel(label: string): string {
    return label.trim().replace(/\s+/g, " ").slice(0, maxLabelLength);
}

function isSavedViewScope(value: unknown): value is AdminSavedViewScope {
    return value === "audit" || value === "integration-health" || value === "jobs";
}

function createSavedViewId(scope: AdminSavedViewScope): string {
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `${scope}:${Date.now().toString(36)}:${randomPart}`;
}
