import { isWithinQuietHours, toMillis } from '@zeffuro/fakegaming-common/utils';

interface NotificationSuppressionConfig {
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    cooldownMinutes?: number | null;
    lastNotifiedAt?: string | number | Date | null;
}

export interface NotificationSuppression {
    suppressedByQuiet: boolean;
    suppressedByCooldown: boolean;
    shouldSuppress: boolean;
}

export function getNotificationSuppression(config: NotificationSuppressionConfig, now: Date): NotificationSuppression {
    const suppressedByQuiet = isWithinQuietHours(config.quietHoursStart ?? null, config.quietHoursEnd ?? null, now);
    const lastNotifiedDate = config.lastNotifiedAt ? new Date(toMillis(config.lastNotifiedAt)) : null;
    const suppressedByCooldown = typeof config.cooldownMinutes === 'number' && config.cooldownMinutes > 0 && lastNotifiedDate
        ? now.getTime() - lastNotifiedDate.getTime() < config.cooldownMinutes * 60_000
        : false;

    return {
        suppressedByQuiet,
        suppressedByCooldown,
        shouldSuppress: suppressedByQuiet || suppressedByCooldown
    };
}
