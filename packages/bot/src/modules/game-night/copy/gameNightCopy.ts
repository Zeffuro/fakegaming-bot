import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import type { GameNightErrorCode, GameNightKind } from '@zeffuro/fakegaming-common/managers';
import { createBotTranslator, type BotMessages, type SupportedOutputLocale } from '../../../core/localization.js';
import englishMessages from '../../../messages/en/game-night.json' with { type: 'json' };
import dutchMessages from '../../../messages/nl/game-night.json' with { type: 'json' };

interface GameNightCopy {
    command: typeof englishMessages.command;
    guildOnly: string;
    nominated: (game: string) => string;
    votingOpened: string;
    closed: string;
    unavailable: string;
    title: (kind: GameNightKind, name: string) => string;
    host: (creatorId: string) => string;
    multipleNominationsEnabled: string;
    multipleNominationsLimited: string;
    expiry: (unixSeconds: number) => string;
    nominationHeading: string;
    noNominations: string;
    nominatingState: string;
    votingState: string;
    finishedState: string;
    expiredState: string;
    tonight: (game: string) => string;
    tieResolved: (games: string) => string;
    voteLine: (position: number, game: string, votes: number) => string;
    nominationLine: (position: number, game: string) => string;
    openVotingButton: string;
    pickWinnerButton: string;
    error: (code: GameNightErrorCode) => string;
}

export function getGameNightCopy(locale: SupportedOutputLocale): GameNightCopy {
    const messages = resolveLocaleValue(locale, {
        en: englishMessages,
        nl: dutchMessages,
    } satisfies OutputLocaleValues<BotMessages>) as typeof englishMessages;
    const raw = messages;
    const t = createBotTranslator(locale, messages);
    return {
        command: raw.command,
        guildOnly: raw.guildOnly,
        votingOpened: raw.votingOpened,
        closed: raw.closed,
        unavailable: raw.unavailable,
        nominationHeading: raw.nominationHeading,
        noNominations: raw.noNominations,
        multipleNominationsEnabled: raw.multipleNominationsEnabled,
        multipleNominationsLimited: raw.multipleNominationsLimited,
        nominatingState: raw.nominatingState,
        votingState: raw.votingState,
        finishedState: raw.finishedState,
        expiredState: raw.expiredState,
        openVotingButton: raw.openVotingButton,
        pickWinnerButton: raw.pickWinnerButton,
        nominated: game => t('nominated', { game }),
        title: (kind, name) => t('title', { kind, name }),
        host: creatorId => t('host', { creatorId }),
        expiry: unixSeconds => t('expiry', { unixSeconds }),
        tonight: game => t('tonight', { game }),
        tieResolved: games => t('tieResolved', { games }),
        voteLine: (position, game, votes) => t('voteLine', { position, game, votes }),
        nominationLine: (position, game) => t('nominationLine', { position, game }),
        error: code => t(`error.${code}`),
    };
}

export const gameNightCopy = getGameNightCopy('en');
