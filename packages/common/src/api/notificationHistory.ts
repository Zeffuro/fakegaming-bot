export const NOTIFICATION_HISTORY_KINDS = ['reminder', 'follow', 'schedule', 'briefing', 'digest', 'anime'] as const;
export const NOTIFICATION_HISTORY_STATUSES = ['pending', 'sent', 'delayed', 'skipped', 'failed', 'uncertain'] as const;
export const NOTIFICATION_HISTORY_REASONS = ['paused', 'quietHours', 'digestTime', 'retry', 'empty', 'ineligible', 'unknown', 'interrupted'] as const;
export type NotificationHistoryKind = typeof NOTIFICATION_HISTORY_KINDS[number];
export type NotificationHistoryStatus = typeof NOTIFICATION_HISTORY_STATUSES[number];
export type NotificationHistoryReason = typeof NOTIFICATION_HISTORY_REASONS[number];

export interface NotificationHistoryEntry {
    id: string;
    kind: NotificationHistoryKind;
    status: NotificationHistoryStatus;
    reason: NotificationHistoryReason | null;
    title: string;
    scheduledAt: number;
    updatedAt: number;
    sentAt: number | null;
    messageUrl: string | null;
}

export interface NotificationHistoryPage {
    items: NotificationHistoryEntry[];
    total: number;
    offset: number;
    limit: number;
    retentionDays: 90;
}
