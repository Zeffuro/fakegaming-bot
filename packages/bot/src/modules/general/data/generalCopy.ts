import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import type { VoiceChannelOccupancyTargetErrorCode } from '../shared/voiceChannelOccupancyRuntime.js';

export interface GeneralCopy {
    calendar: { serverOnly: string; birthdays: string; reminders: string; empty: (days: number) => string; title: (days: number) => string };
    help: { userMenu: string; messageMenu: string; available: string; more: string; noDescription: string };
    permissions: {
        serverOnly: string; adminOnly: string; none: string; recent: string; notFound: (id: number) => string;
        deleted: (id: number) => string; tooLarge: (id: number) => string; snapshot: (id: number) => string;
        saved: (id: number) => string; compressed: string; attachmentTooLarge: string; partialMembers: string;
        partialRoles: string; partialChannels: string; summary: (roles: number, source: string, members: number, channels: number) => string;
    };
    occupyChannel: {
        serverOnly: string;
        enabled: (channelId: string) => string;
        enabledRetrying: (channelId: string) => string;
        disabled: string;
        alreadyDisabled: string;
        statusDisabled: string;
        statusReady: (channelId: string) => string;
        statusConnecting: (channelId: string) => string;
        statusDisconnected: (channelId: string) => string;
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

const en: GeneralCopy = {
    calendar: { serverOnly: 'Calendar only works in a server.', birthdays: 'Birthdays', reminders: 'Your Reminders', empty: days => `No birthdays or reminders in the next ${days} days.`, title: days => `Upcoming calendar for the next ${days} days:` },
    help: { userMenu: 'User menu', messageMenu: 'Message menu', available: 'Available Commands', more: 'More Commands', noDescription: 'No description available' },
    permissions: {
        serverOnly: 'Permission backups only work in a server.', adminOnly: 'Only server administrators can access permission backups.', none: 'No permission snapshots have been saved for this server.', recent: 'Recent permission snapshots:',
        notFound: id => `Permission snapshot #${id} was not found for this server.`, deleted: id => `Permission snapshot #${id} was deleted.`, tooLarge: id => `Permission snapshot #${id} is too large for a single Discord attachment.`, snapshot: id => `Permission snapshot #${id}`,
        saved: id => `Saved permission snapshot #${id}`, compressed: ' The attached export is gzip-compressed.', attachmentTooLarge: ' The export exceeds Discord\'s attachment limit, but the snapshot was saved.', partialMembers: ' Discord did not provide a complete member list, so cached members were used.', partialRoles: ' Discord did not provide refreshed role data, so cached roles were used.', partialChannels: ' Discord did not provide refreshed channel data, so cached channels were used.',
        summary: (roles, source, members, channels) => `${roles} roles, ${source} members (${members}), ${channels} categories/channels`,
    },
    occupyChannel: {
        serverOnly: 'Voice channel occupancy only works in a server.',
        enabled: channelId => `I am now occupying <#${channelId}> while the bot is online. I am muted and deafened.`,
        enabledRetrying: channelId => `<#${channelId}> is configured, but the voice connection is still retrying. Use \`/occupy-channel status\` to check it.`,
        disabled: 'Voice channel occupancy is disabled and the bot has left the channel.',
        alreadyDisabled: 'Voice channel occupancy was already disabled.',
        statusDisabled: 'Voice channel occupancy is disabled for this server.',
        statusReady: channelId => `Voice channel occupancy is active in <#${channelId}>.`,
        statusConnecting: channelId => `Voice channel occupancy is configured for <#${channelId}> and is connecting or retrying.`,
        statusDisconnected: channelId => `Voice channel occupancy is configured for <#${channelId}>, but the bot is not connected.`,
        failure: {
            'guild-unavailable': 'This server is currently unavailable to the bot.',
            'channel-unavailable': 'That voice channel is unavailable or no longer exists.',
            'not-voice-channel': 'Choose a normal voice channel.',
            'missing-permissions': 'I need View Channel and Connect permissions in that voice channel.',
            'channel-full': 'That voice channel is full. Choose a channel with an available slot.',
        },
    },
    poll: {
        questionRequired: 'Please provide a poll question.', twoOptions: 'Please provide at least two options for the poll.', unique: 'Poll options must be unique.', duration: (min, max) => `Duration must be between ${min} and ${max} minutes.`, creating: 'Creating poll...', capacity: 'Too many active polls are already running. Please try again shortly.', creatorOnly: 'Only the poll creator can close this poll.', unavailable: 'This poll is no longer available. It may have expired or the bot restarted.', closed: 'This poll is closed.', closeButton: 'Close poll', closes: unix => `Closes <t:${unix}:R>.`, closedByExpiry: 'Poll closed when its duration elapsed.', closedByCreator: 'Poll closed by its creator.', votes: count => `${count} vote${count === 1 ? '' : 's'}`, total: count => `Total votes: ${count}`, noVotes: 'Result: no votes were cast.', winner: (name, count) => `Winner: **${name}** (${count} vote${count === 1 ? '' : 's'}).`, tie: (names, count) => `Result: tie between ${names} (${count} vote${count === 1 ? '' : 's'} each).`,
    },
    profile: { caption: mention => `Profile card for ${mention}`, fallback: 'Discord user' },
    roll: { rolled: (roll, detail) => `🎲 You rolled a **${roll}** (${detail})`, rolls: (rolls, total, detail) => `🎲 You rolled: ${rolls} (Total: **${total}**) [${detail}]`, reasonable: 'Please use a reasonable dice notation (e.g., 1d20, max 20 dice, 1000 sides).', invalid: 'Invalid input. Use dice notation (e.g., 2d6) or a max number (e.g., 100).', total: 'Total' },
    spin: { twoNames: 'Please provide at least two names.', starting: 'Spinning the wheel...', spinning: name => `🔄 Spinning... **${name}**`, winner: name => `🎉 The wheel stopped at: **${name}**!` },
    testNotification: { cannotSend: 'I cannot send a test notification in that channel.', defaultMessage: 'This is a test notification from Fakegaming Bot.', title: 'Test Notification', description: 'If you can see this, bot notifications can be delivered to this channel.', sent: channel => `Sent a test notification to ${channel}.` },
    time: { invalidZone: 'Invalid timezone. Please use a valid IANA timezone (for example, Europe/Amsterdam) or GMT offset.', invalidTime: 'Invalid time. Try `now`, `20:30`, `2026-06-11 20:30`, an ISO timestamp, or a Unix timestamp.', input: 'Input', local: 'Local time', long: 'Long', short: 'Short', time: 'Time', relative: 'Relative', copy: 'Copy', unix: 'Unix' },
    weather: { forecast: 'Short-term forecast:', weatherFor: 'Weather for', current: 'Current', temperature: 'Temperature', feelsLike: 'feels like', humidity: 'Humidity', wind: 'Wind', notFound: 'Could not fetch weather data. Please check the location and try again.', noKey: 'Weather API key is not configured.', error: 'An error occurred while fetching weather data.' },
};

const nl: GeneralCopy = {
    calendar: { serverOnly: 'De kalender werkt alleen op een server.', birthdays: 'Verjaardagen', reminders: 'Je herinneringen', empty: days => `Geen verjaardagen of herinneringen in de komende ${days} dagen.`, title: days => `Kalender voor de komende ${days} dagen:` },
    help: { userMenu: 'Gebruikersmenu', messageMenu: 'Berichtenmenu', available: 'Beschikbare opdrachten', more: 'Meer opdrachten', noDescription: 'Geen beschrijving beschikbaar' },
    permissions: {
        serverOnly: 'Back-ups van rechten werken alleen op een server.', adminOnly: 'Alleen serverbeheerders hebben toegang tot back-ups van rechten.', none: 'Er zijn geen momentopnamen van rechten voor deze server opgeslagen.', recent: 'Recente momentopnamen van rechten:',
        notFound: id => `Momentopname van rechten #${id} is niet gevonden voor deze server.`, deleted: id => `Momentopname van rechten #${id} is verwijderd.`, tooLarge: id => `Momentopname van rechten #${id} is te groot voor één Discord-bijlage.`, snapshot: id => `Momentopname van rechten #${id}`,
        saved: id => `Momentopname van rechten #${id} opgeslagen`, compressed: ' De bijgevoegde export is met gzip gecomprimeerd.', attachmentTooLarge: ' De export overschrijdt de bijlagelimiet van Discord, maar de momentopname is opgeslagen.', partialMembers: ' Discord gaf geen volledige ledenlijst; daarom zijn leden uit de cache gebruikt.', partialRoles: ' Discord gaf geen vernieuwde rolgegevens; daarom zijn rollen uit de cache gebruikt.', partialChannels: ' Discord gaf geen vernieuwde kanaalgegevens; daarom zijn kanalen uit de cache gebruikt.',
        summary: (roles, source, members, channels) => `${roles} rollen, ${source === 'fetched' ? 'opgehaalde' : 'gecachete'} leden (${members}), ${channels} categorieën/kanalen`,
    },
    occupyChannel: {
        serverOnly: 'Spraakkanaalbezetting werkt alleen op een server.',
        enabled: channelId => `Ik houd <#${channelId}> nu bezet zolang de bot online is. Ik ben gedempt en doof geschakeld.`,
        enabledRetrying: channelId => `<#${channelId}> is ingesteld, maar de spraakverbinding probeert nog te herstellen. Controleer dit met \`/occupy-channel status\`.`,
        disabled: 'Spraakkanaalbezetting is uitgeschakeld en de bot heeft het kanaal verlaten.',
        alreadyDisabled: 'Spraakkanaalbezetting was al uitgeschakeld.',
        statusDisabled: 'Spraakkanaalbezetting is uitgeschakeld voor deze server.',
        statusReady: channelId => `Spraakkanaalbezetting is actief in <#${channelId}>.`,
        statusConnecting: channelId => `Spraakkanaalbezetting is ingesteld voor <#${channelId}> en maakt verbinding of probeert opnieuw.`,
        statusDisconnected: channelId => `Spraakkanaalbezetting is ingesteld voor <#${channelId}>, maar de bot is niet verbonden.`,
        failure: {
            'guild-unavailable': 'Deze server is momenteel niet beschikbaar voor de bot.',
            'channel-unavailable': 'Dat spraakkanaal is niet beschikbaar of bestaat niet meer.',
            'not-voice-channel': 'Kies een normaal spraakkanaal.',
            'missing-permissions': 'Ik heb de rechten Kanaal bekijken en Verbinden nodig in dat spraakkanaal.',
            'channel-full': 'Dat spraakkanaal is vol. Kies een kanaal met een beschikbare plek.',
        },
    },
    poll: {
        questionRequired: 'Geef een vraag voor de peiling op.', twoOptions: 'Geef minstens twee opties voor de peiling op.', unique: 'De opties van een peiling moeten uniek zijn.', duration: (min, max) => `De duur moet tussen ${min} en ${max} minuten liggen.`, creating: 'Peiling wordt gemaakt...', capacity: 'Er zijn te veel actieve peilingen. Probeer het binnenkort opnieuw.', creatorOnly: 'Alleen de maker kan deze peiling sluiten.', unavailable: 'Deze peiling is niet meer beschikbaar. Mogelijk is deze verlopen of is de bot opnieuw gestart.', closed: 'Deze peiling is gesloten.', closeButton: 'Peiling sluiten', closes: unix => `Sluit <t:${unix}:R>.`, closedByExpiry: 'De peiling is gesloten toen de duur verstreek.', closedByCreator: 'De peiling is door de maker gesloten.', votes: count => `${count} ${count === 1 ? 'stem' : 'stemmen'}`, total: count => `Totaal aantal stemmen: ${count}`, noVotes: 'Resultaat: er zijn geen stemmen uitgebracht.', winner: (name, count) => `Winnaar: **${name}** (${count} ${count === 1 ? 'stem' : 'stemmen'}).`, tie: (names, count) => `Resultaat: gelijkspel tussen ${names} (elk ${count} ${count === 1 ? 'stem' : 'stemmen'}).`,
    },
    profile: { caption: mention => `Profielkaart voor ${mention}`, fallback: 'Discord-gebruiker' },
    roll: { rolled: (roll, detail) => `🎲 Je wierp **${roll}** (${detail})`, rolls: (rolls, total, detail) => `🎲 Je wierp: ${rolls} (Totaal: **${total}**) [${detail}]`, reasonable: 'Gebruik een redelijke dobbelnotatie (bijv. 1d20, maximaal 20 dobbelstenen en 1000 zijden).', invalid: 'Ongeldige invoer. Gebruik dobbelnotatie (bijv. 2d6) of een maximumgetal (bijv. 100).', total: 'Totaal' },
    spin: { twoNames: 'Geef minstens twee namen op.', starting: 'Het rad draait...', spinning: name => `🔄 Draaien... **${name}**`, winner: name => `🎉 Het rad stopte bij: **${name}**!` },
    testNotification: { cannotSend: 'Ik kan in dat kanaal geen testmelding sturen.', defaultMessage: 'Dit is een testmelding van Fakegaming Bot.', title: 'Testmelding', description: 'Als je dit ziet, kunnen botmeldingen in dit kanaal worden afgeleverd.', sent: channel => `Testmelding verstuurd naar ${channel}.` },
    time: { invalidZone: 'Ongeldige tijdzone. Gebruik een geldige IANA-tijdzone (bijvoorbeeld Europe/Amsterdam) of GMT-afwijking.', invalidTime: 'Ongeldige tijd. Probeer `now`, `20:30`, `2026-06-11 20:30`, een ISO-tijdstempel of Unix-tijdstempel.', input: 'Invoer', local: 'Lokale tijd', long: 'Lang', short: 'Kort', time: 'Tijd', relative: 'Relatief', copy: 'Kopiëren', unix: 'Unix' },
    weather: { forecast: 'Korte verwachting:', weatherFor: 'Weer voor', current: 'Nu', temperature: 'Temperatuur', feelsLike: 'voelt als', humidity: 'Luchtvochtigheid', wind: 'Wind', notFound: 'Kon geen weergegevens ophalen. Controleer de locatie en probeer het opnieuw.', noKey: 'De API-sleutel voor het weer is niet ingesteld.', error: 'Er is een fout opgetreden bij het ophalen van weergegevens.' },
};

export function getGeneralCopy(locale: SupportedOutputLocale): GeneralCopy {
    return resolveLocaleValue(locale, { en, nl } satisfies OutputLocaleValues<GeneralCopy>);
}
