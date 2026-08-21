import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import { createBotTranslator, type BotMessages, type SupportedOutputLocale } from '../../../core/localization.js';
import type { VoiceChannelOccupancyTargetErrorCode } from '../shared/voiceChannelOccupancyRuntime.js';
import englishMessages from '../../../messages/en/general.json' with { type: 'json' };
import dutchMessages from '../../../messages/nl/general.json' with { type: 'json' };

export interface GeneralCopy {
    calendar: { serverOnly: string; birthdays: string; reminders: string; empty: (days: number) => string; title: (days: number) => string };
    help: { userMenu: string; messageMenu: string; available: string; more: string; noDescription: string };
    permissions: {
        serverOnly: string; adminOnly: string; none: string; recent: string; notFound: (id: number) => string;
        deleted: (id: number) => string; tooLarge: (id: number) => string; snapshot: (id: number) => string;
        saved: (id: number) => string; compressed: string; attachmentTooLarge: string; partialMembers: string;
        partialRoles: string; partialChannels: string;
        summary: (roles: number, source: string, members: number, channels: number) => string;
    };
    occupyChannel: {
        serverOnly: string; enabled: (channelId: string) => string; enabledRetrying: (channelId: string) => string;
        disabled: string; alreadyDisabled: string; statusDisabled: string; statusReady: (channelId: string) => string;
        statusConnecting: (channelId: string) => string; statusDisconnected: (channelId: string) => string;
        failure: Record<VoiceChannelOccupancyTargetErrorCode, string>;
    };
    poll: {
        questionRequired: string; twoOptions: string; unique: string; duration: (min: number, max: number) => string;
        creating: string; capacity: string; creatorOnly: string; unavailable: string; closed: string; closeButton: string;
        closes: (unix: number) => string; closedByExpiry: string; closedByCreator: string; votes: (count: number) => string;
        total: (count: number) => string; noVotes: string; winner: (name: string, count: number) => string;
        tie: (names: string, count: number) => string;
    };
    profile: { caption: (mention: string) => string; fallback: string };
    roll: { rolled: (roll: number, detail: string) => string; rolls: (rolls: string, total: number, detail: string) => string; reasonable: string; invalid: string; total: string };
    spin: { twoNames: string; starting: string; spinning: (name: string) => string; winner: (name: string) => string };
    testNotification: { cannotSend: string; defaultMessage: string; title: string; description: string; sent: (channel: string) => string };
    time: { invalidZone: string; invalidTime: string; input: string; local: string; long: string; short: string; time: string; relative: string; copy: string; unix: string };
    weather: { forecast: string; weatherFor: string; current: string; temperature: string; feelsLike: string; humidity: string; wind: string; notFound: string; noKey: string; error: string };
}

export function getGeneralCopy(locale: SupportedOutputLocale): GeneralCopy {
    const messages = resolveLocaleValue(locale, { en: englishMessages, nl: dutchMessages } satisfies OutputLocaleValues<BotMessages>) as typeof englishMessages;
    const raw = messages as typeof englishMessages;
    const t = createBotTranslator(locale, messages);
    return {
        ...raw,
        calendar: { ...raw.calendar, empty: days => t('calendar.empty', { days }), title: days => t('calendar.title', { days }) },
        permissions: {
            ...raw.permissions,
            notFound: id => t('permissions.notFound', { id }), deleted: id => t('permissions.deleted', { id }),
            tooLarge: id => t('permissions.tooLarge', { id }), snapshot: id => t('permissions.snapshot', { id }),
            saved: id => t('permissions.saved', { id }),
            summary: (roles, source, members, channels) => t('permissions.summary', { roles, source, members, channels }),
        },
        occupyChannel: {
            ...raw.occupyChannel,
            enabled: channelId => t('occupyChannel.enabled', { channelId }),
            enabledRetrying: channelId => t('occupyChannel.enabledRetrying', { channelId }),
            statusReady: channelId => t('occupyChannel.statusReady', { channelId }),
            statusConnecting: channelId => t('occupyChannel.statusConnecting', { channelId }),
            statusDisconnected: channelId => t('occupyChannel.statusDisconnected', { channelId }),
        },
        poll: {
            ...raw.poll,
            duration: (min, max) => t('poll.duration', { min, max }), closes: unix => t('poll.closes', { unix }),
            votes: count => t('poll.votes', { count }), total: count => t('poll.total', { count }),
            winner: (name, count) => t('poll.winner', { name, count }), tie: (names, count) => t('poll.tie', { names, count }),
        },
        profile: { ...raw.profile, caption: mention => t('profile.caption', { mention }) },
        roll: {
            ...raw.roll,
            rolled: (roll, detail) => t('roll.rolled', { roll, detail }),
            rolls: (rolls, total, detail) => t('roll.rolls', { rolls, total, detail }),
        },
        spin: { ...raw.spin, spinning: name => t('spin.spinning', { name }), winner: name => t('spin.winner', { name }) },
        testNotification: { ...raw.testNotification, sent: channel => t('testNotification.sent', { channel }) },
    } satisfies GeneralCopy;
}
