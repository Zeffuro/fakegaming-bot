export interface ConfigNotificationInfo {
    lines: string[];
}

export function getNotificationInfo(config: {
    cooldownMinutes?: unknown;
    quietHoursStart?: unknown;
    quietHoursEnd?: unknown;
}): ConfigNotificationInfo | undefined {
    const lines: string[] = [];
    const cooldownMinutes = typeof config.cooldownMinutes === "number" && Number.isFinite(config.cooldownMinutes)
        ? config.cooldownMinutes
        : null;

    if (cooldownMinutes !== null && cooldownMinutes > 0) {
        lines.push(`Cooldown: ${cooldownMinutes} ${cooldownMinutes === 1 ? "minute" : "minutes"}`);
    }

    const quietHoursStart = normalizeTimeLabel(config.quietHoursStart);
    const quietHoursEnd = normalizeTimeLabel(config.quietHoursEnd);
    if (quietHoursStart && quietHoursEnd) {
        lines.push(`Quiet hours: ${quietHoursStart} to ${quietHoursEnd}`);
    }

    return lines.length > 0 ? { lines } : undefined;
}

function normalizeTimeLabel(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
