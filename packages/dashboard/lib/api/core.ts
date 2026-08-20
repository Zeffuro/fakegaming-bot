import { CSRF_HEADER_NAME } from "@zeffuro/fakegaming-common/security";
import { getBrowserCookie, redirectToLogin, refreshAuthSession } from "@/lib/auth/clientAuth";
import { getDashboardLocale } from "@/lib/i18n/localeStore";
import { formatDashboardMessage } from "@/lib/i18n/messages";

export const API_ENDPOINTS = {
    TWITCH: "/api/external/twitch",
    TIKTOK: "/api/external/tiktok",
    BLUESKY: "/api/external/bluesky",
    YOUTUBE: "/api/external/youtube",
    PATCH_NOTES: "/api/external/patchNotes",
    PATCH_SUBSCRIPTIONS: "/api/external/patchSubscriptions",
    STEAM_APPS: "/api/external/steamApps",
    STEAM_NEWS_SUBSCRIPTIONS: "/api/external/steamNewsSubscriptions",
    ANIME: "/api/external/anime",
    QUOTES: "/api/external/quotes",
    BIRTHDAYS: "/api/external/birthdays",
    DISCORD: "/api/external/discord",
    DISABLED_MODULES: "/api/external/disabledModules",
    DISABLED_COMMANDS: "/api/external/disabledCommands",
    JOBS: "/api/external/jobs",
    RIOT_LINKS: "/api/external/riotLinks",
    DASHBOARD: "/api/external/dashboard",
    INTEGRATION_HEALTH: "/api/external/integrationHealth",
    NOTIFICATIONS: "/api/external/notifications",
    SETUP_TEMPLATES: "/api/external/setupTemplates",
    USER_NOTES: "/api/external/userNotes",
    USER_REMINDERS: "/api/external/userReminders",
    USER_SETTINGS: "/api/external/userSettings",
    USER_DIGEST_SUBSCRIPTION: "/api/external/userDigestSubscription",
    USER_ACTIVITY: "/api/external/userActivity",
    ROLE_PERMISSION_SNAPSHOTS: "/api/external/rolePermissionSnapshots",
    GUILD_LOCALE_CONFIG: "/api/external/guildLocaleConfig",
};

export interface ApiOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
    credentials?: RequestCredentials;
}

function isMutating(method: string): boolean {
    const normalizedMethod = method.toUpperCase();
    return normalizedMethod === "POST"
        || normalizedMethod === "PUT"
        || normalizedMethod === "PATCH"
        || normalizedMethod === "DELETE";
}

async function fetchDashboardApi(endpoint: string, requestOptions: RequestInit): Promise<Response> {
    try {
        return await fetch(endpoint, requestOptions);
    } catch {
        throw new Error(formatDashboardMessage(getDashboardLocale(), "error.network"));
    }
}

function getApiErrorMessage(errorData: unknown, status: number): string {
    const errorObject = typeof errorData === "object" && errorData !== null ? errorData : null;
    const apiError = errorObject && "error" in errorObject
        ? (errorObject as { error?: unknown }).error
        : undefined;
    const apiErrorMessage = typeof apiError === "object" && apiError !== null && "message" in apiError
        ? (apiError as { message?: unknown }).message
        : undefined;
    const detailMessage = errorObject && "details" in errorObject
        ? (errorObject as { details?: unknown }).details
        : undefined;
    const fallbackMessage = errorObject && "message" in errorObject
        ? (errorObject as { message?: unknown }).message
        : undefined;

    if (apiError === "CSRF" && typeof detailMessage === "string") {
        return detailMessage;
    }

    return (typeof apiError === "string" ? apiError : undefined)
        || (typeof apiErrorMessage === "string" ? apiErrorMessage : undefined)
        || (typeof fallbackMessage === "string" ? fallbackMessage : undefined)
        || formatDashboardMessage(getDashboardLocale(), "error.requestFailed", { status });
}

export async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const {
        method = "GET",
        body,
        headers = {},
        credentials = "include",
    } = options;

    const mergedHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept-Language": getDashboardLocale(),
        ...headers,
    };

    if (isMutating(method) && !(CSRF_HEADER_NAME in mergedHeaders)) {
        const csrf = getBrowserCookie("csrf");
        if (csrf) {
            mergedHeaders[CSRF_HEADER_NAME] = csrf;
        }
    }

    const requestOptions: RequestInit = {
        method,
        credentials,
        headers: mergedHeaders,
    };

    if (body) {
        requestOptions.body = JSON.stringify(body);
    }

    let response = await fetchDashboardApi(endpoint, requestOptions);

    if (!response.ok && response.status === 401) {
        const refreshed = await refreshAuthSession();
        if (refreshed) {
            response = await fetchDashboardApi(endpoint, requestOptions);
        }
        if (!response.ok) {
            redirectToLogin();
        }
    }

    if (!response.ok) {
        const errorData: unknown = await response.json().catch(() => null);
        throw new Error(getApiErrorMessage(errorData, response.status));
    }

    if (response.status === 204) return undefined as T;

    return await response.json();
}

export async function apiBinaryRequest(endpoint: string, options: ApiOptions = {}): Promise<Blob> {
    const {
        method = "GET",
        body,
        headers = {},
        credentials = "include",
    } = options;

    const mergedHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept-Language": getDashboardLocale(),
        ...headers,
    };

    if (isMutating(method) && !(CSRF_HEADER_NAME in mergedHeaders)) {
        const csrf = getBrowserCookie("csrf");
        if (csrf) {
            mergedHeaders[CSRF_HEADER_NAME] = csrf;
        }
    }

    const requestOptions: RequestInit = {
        method,
        credentials,
        headers: mergedHeaders,
    };

    if (body) {
        requestOptions.body = JSON.stringify(body);
    }

    let response = await fetchDashboardApi(endpoint, requestOptions);

    if (!response.ok && response.status === 401) {
        const refreshed = await refreshAuthSession();
        if (refreshed) {
            response = await fetchDashboardApi(endpoint, requestOptions);
        }
        if (!response.ok) {
            redirectToLogin();
        }
    }

    if (!response.ok) {
        const errorData: unknown = await response.json().catch(() => null);
        throw new Error(getApiErrorMessage(errorData, response.status));
    }

    return await response.blob();
}
