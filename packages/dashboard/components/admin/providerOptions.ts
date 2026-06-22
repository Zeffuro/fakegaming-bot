export const ADMIN_PROVIDER_OPTIONS = ["twitch", "youtube", "tiktok", "bluesky", "steamnews", "patchnotes", "anime", "birthday"] as const;

export function getAdminProviderOptions(currentProvider: string): string[] {
    const options = [...ADMIN_PROVIDER_OPTIONS];
    if (currentProvider && !options.includes(currentProvider as typeof ADMIN_PROVIDER_OPTIONS[number])) {
        return [currentProvider, ...options];
    }
    return options;
}

export function normalizeAdminProviderFilter(value: string | null | undefined): string {
    const normalized = value?.trim().toLowerCase().replace(/[\s_-]+/g, "") ?? "";
    if (normalized === "patchnote" || normalized === "patchnotes") return "patchnotes";
    if (normalized === "birthdays") return "birthday";
    return normalized;
}
