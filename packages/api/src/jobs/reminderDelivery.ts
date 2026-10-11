import type { SupportedOutputLocale } from '@zeffuro/fakegaming-common';
import { normalizeNoteSourceUrl } from '@zeffuro/fakegaming-common/managers';
import { apiText } from '../localization/locale.js';
import type { ProductivityNotification } from './productivityReminders.js';

export function buildReminderDeliveryPayload(id: string, content: string, locale: SupportedOutputLocale, personal?: ProductivityNotification) {
    if (personal?.task) {
        const task = personal.task;
        let sourceUrl: string | null = null;
        try { sourceUrl = normalizeNoteSourceUrl(task.sourceUrl); } catch {}
        return { content: content.slice(0, 2000), allowed_mentions: { parse: [] }, components: [{ type: 1, components: [
            { type: 2, style: 3, label: apiText(locale, 'taskDone'), custom_id: `user-task:d:${task.id}:${task.version}:${id}` },
            { type: 2, style: 2, label: apiText(locale, 'reminderSnoozeTenMinutes'), custom_id: `user-task:s:${task.id}:${task.version}:${id}` },
            { type: 2, style: 2, label: apiText(locale, 'taskTomorrow'), custom_id: `user-task:m:${task.id}:${task.version}:${id}` },
            ...(sourceUrl ? [{ type: 2, style: 5, label: apiText(locale, 'noteTaskSource'), url: sourceUrl }] : []),
        ] }] };
    }
    if (personal?.noControls) return { content: content.slice(0, 2000), allowed_mentions: { parse: [] }, components: [] };
    return {
        content: content.slice(0, 2000),
        allowed_mentions: { parse: [] },
        components: [{ type: 1, components: [
            { type: 2, style: 2, label: apiText(locale, 'reminderSnoozeTenMinutes'), custom_id: `reminder:snooze:${id}:600` },
            { type: 2, style: 2, label: apiText(locale, 'reminderSnoozeOneHour'), custom_id: `reminder:snooze:${id}:3600` },
            { type: 2, style: 2, label: apiText(locale, 'reminderCustomSnooze'), custom_id: `reminder:custom-snooze:${id}` },
            { type: 2, style: 2, label: apiText(locale, 'reminderDismiss'), custom_id: `reminder:dismiss:${id}` },
        ] }],
    };
}
