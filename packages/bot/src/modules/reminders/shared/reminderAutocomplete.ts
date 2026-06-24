import type {ApplicationCommandOptionChoiceData, AutocompleteInteraction} from 'discord.js';
import {isRecurringReminder, isReminderPaused, shortReminderId, type ReminderLike} from './reminderFormat.js';
import {listPendingRemindersForUser, listRemindersForUser, sortReminderByTimestamp} from './reminderLookup.js';

export type ReminderAutocompleteMode = 'pending' | 'active-recurring' | 'paused-recurring';

interface ReminderChoiceCandidate {
    reminder: ReminderLike;
    state: string | null;
}

export async function autocompleteReminderIds(
    interaction: AutocompleteInteraction,
    mode: ReminderAutocompleteMode
): Promise<void> {
    const focused = interaction.options.getFocused();
    const choices = await getReminderAutocompleteChoices(interaction.user.id, focused, mode);
    await interaction.respond(choices);
}

export async function getReminderAutocompleteChoices(
    userId: string,
    focused: string,
    mode: ReminderAutocompleteMode,
    nowMs = Date.now()
): Promise<ApplicationCommandOptionChoiceData<string>[]> {
    const candidates = await getReminderChoiceCandidates(userId, mode, nowMs);
    const query = focused.trim().toLowerCase();

    return candidates
        .filter(({reminder}) => matchesReminderQuery(reminder, query))
        .slice(0, 25)
        .map(({reminder, state}) => ({
            name: formatReminderChoiceName(reminder, state, nowMs),
            value: shortReminderId(reminder.id),
        }));
}

async function getReminderChoiceCandidates(
    userId: string,
    mode: ReminderAutocompleteMode,
    nowMs: number
): Promise<ReminderChoiceCandidate[]> {
    if (mode === 'pending') {
        const reminders = await listPendingRemindersForUser(userId, nowMs);
        return reminders.map((reminder) => ({
            reminder,
            state: isRecurringReminder(reminder) ? 'recurring' : null,
        }));
    }

    const reminders = (await listRemindersForUser(userId)).sort(sortReminderByTimestamp);
    return reminders
        .filter((reminder) => isRecurringReminder(reminder))
        .filter((reminder) => mode === 'paused-recurring' ? isReminderPaused(reminder) : !isReminderPaused(reminder))
        .map((reminder) => ({
            reminder,
            state: mode === 'paused-recurring' ? 'paused' : 'recurring',
        }));
}

function matchesReminderQuery(reminder: ReminderLike, query: string): boolean {
    if (!query) return true;

    return reminder.id.toLowerCase().includes(query)
        || shortReminderId(reminder.id).toLowerCase().includes(query)
        || reminder.message.toLowerCase().includes(query);
}

function formatReminderChoiceName(reminder: ReminderLike, state: string | null, nowMs: number): string {
    const shortId = shortReminderId(reminder.id);
    const message = truncateChoicePart(reminder.message.replace(/\s+/g, ' ').trim(), 52);
    const due = formatReminderDueTime(reminder.timestamp, nowMs);
    const stateText = state ? ` [${state}]` : '';
    return truncateChoicePart(`${shortId} - ${message} - ${due}${stateText}`, 100);
}

function formatReminderDueTime(value: ReminderLike['timestamp'], nowMs: number): string {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp)) return 'unknown time';

    const diffMs = timestamp - nowMs;
    if (diffMs <= 0) return 'due now';

    const minutes = Math.max(1, Math.round(diffMs / 60_000));
    if (minutes < 60) return `in ${minutes}m`;

    const hours = Math.round(minutes / 60);
    if (hours < 48) return `in ${hours}h`;

    const days = Math.round(hours / 24);
    return `in ${days}d`;
}

function truncateChoicePart(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    if (maxLength <= 1) return value.slice(0, maxLength);
    if (maxLength <= 3) return value.slice(0, maxLength);
    return `${value.slice(0, maxLength - 3)}...`;
}
