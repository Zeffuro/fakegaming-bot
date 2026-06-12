import { CSRF_HEADER_NAME } from "@zeffuro/fakegaming-common/security";

let refreshPromise: Promise<boolean> | null = null;
let loginRedirectStarted = false;

export function getBrowserCookie(name: string): string | undefined {
    if (typeof document === "undefined") return undefined;

    const escapedName = name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
    return match ? decodeURIComponent(match[1]!) : undefined;
}

async function executeRefresh(): Promise<boolean> {
    try {
        const csrf = getBrowserCookie("csrf");
        const response = await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
            headers: csrf ? { [CSRF_HEADER_NAME]: csrf } : undefined,
        });
        return response.ok;
    } catch {
        return false;
    }
}

export async function refreshAuthSession(): Promise<boolean> {
    if (refreshPromise) {
        return await refreshPromise;
    }

    refreshPromise = executeRefresh();
    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
    }
}

export function redirectToLogin(): void {
    if (typeof window === "undefined" || loginRedirectStarted) return;

    loginRedirectStarted = true;
    const path = window.location.pathname + window.location.search;
    const returnTo = path || "/dashboard";
    window.location.href = `/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`;
}
