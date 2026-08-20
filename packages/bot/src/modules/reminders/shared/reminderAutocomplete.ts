import { DEFAULT_OUTPUT_LOCALE } from '@zeffuro/fakegaming-common';
import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import type {ApplicationCommandOptionChoiceData, AutocompleteInteraction} from 'discord.js';
import {isRecurringReminder, isReminderPaused, shortReminderId, type ReminderLike} from './reminderFormat.js';
import {listPendingRemindersForUser, listRemindersForUser, sortReminderByTimestamp} from './reminderLookup.js';
import type {SupportedOutputLocale} from '../../../core/localization.js';

export type ReminderAutocompleteMode = 'pending' | 'active-recurring' | 'paused-recurring';

interface ReminderChoiceCandidate {
    reminder: ReminderLike;
    state: string | null;
}

export async function autocompleteReminderIds(
    interaction: AutocompleteInteraction,
    mode: ReminderAutocompleteMode,
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): Promise<void> {
    const focused = interaction.options.getFocused();
    const choices = await getReminderAutocompleteChoices(interaction.user.id, focused, mode, Date.now(), locale);
    await interaction.respond(choices);
}

export async function getReminderAutocompleteChoices(
    userId: string,
    focused: string,
    mode: ReminderAutocompleteMode,
    nowMs = Date.now(),
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): Promise<ApplicationCommandOptionChoiceData<string>[]> {
    const candidates = await getReminderChoiceCandidates(userId, mode, nowMs);
    const query = focused.trim().toLowerCase();

    return candidates
        .filter(({reminder}) => matchesReminderQuery(reminder, query))
        .slice(0, 25)
        .map(({reminder, state}) => ({
            name: formatReminderChoiceName(reminder, state, nowMs, locale),
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

function formatReminderChoiceName(reminder: ReminderLike, state: string | null, nowMs: number, locale: SupportedOutputLocale): string {
    const shortId = shortReminderId(reminder.id);
    const message = truncateChoicePart(reminder.message.replace(/\s+/g, ' ').trim(), 52);
    const due = formatReminderDueTime(reminder.timestamp, nowMs, locale);
    const localizedState = resolveLocaleValue(locale, { en: state, nl: state === 'paused' ? 'gepauzeerd' : 'herhalend' });
    const stateText = localizedState ? ` [${localizedState}]` : '';
    return truncateChoicePart(`${shortId} - ${message} - ${due}${stateText}`, 100);
}

function formatReminderDueTime(value: ReminderLike['timestamp'], nowMs: number, locale: SupportedOutputLocale): string {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp)) return resolveLocaleValue(locale, { en: 'unknown time', nl: 'onbekende tijd' });

    const diffMs = timestamp - nowMs;
    if (diffMs <= 0) return resolveLocaleValue(locale, { en: 'due now', nl: 'nu verwacht' });

    const minutes = Math.max(1, Math.round(diffMs / 60_000));
    if (minutes < 60) return `over ${minutes}m`.replace('over', resolveLocaleValue(locale, { en: 'in', nl: 'over' }));

    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${resolveLocaleValue(locale, { en: 'in', nl: 'over' })} ${hours}h`;

    const days = Math.round(hours / 24);
    return `${resolveLocaleValue(locale, { en: 'in', nl: 'over' })} ${days}d`;
}

function truncateChoicePart(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    if (maxLength <= 1) return value.slice(0, maxLength);
    if (maxLength <= 3) return value.slice(0, maxLength);
    return `${value.slice(0, maxLength - 3)}...`;
}
