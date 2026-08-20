import { resolveLocaleValue, type OutputLocaleValues } from '@zeffuro/fakegaming-common';
import type { GameNightErrorCode } from '@zeffuro/fakegaming-common/managers';
import type { SupportedOutputLocale } from '../../../core/localization.js';

interface GameNightCopy {
    command: {
        start: string;
        startName: string;
        duration: string;
        nominate: string;
        game: string;
        open: string;
        close: string;
        status: string;
    };
    guildOnly: string;
    nominated: (game: string) => string;
    votingOpened: string;
    closed: string;
    unavailable: string;
    title: (name: string) => string;
    host: (creatorId: string) => string;
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

const english: GameNightCopy = {
    command: {
        start: 'Start a new game night in this channel', startName: 'A short name for this game night',
        duration: 'Hours before an unfinished game night expires', nominate: 'Nominate one game for the active game night',
        game: 'The game to nominate', open: 'Open voting on the nominations', close: 'Close voting and pick the winner',
        status: 'Show the current game night state',
    },
    guildOnly: 'Game Night Board is only available in a server.',
    nominated: game => `Nominated **${game}**.`, votingOpened: 'Voting is open.', closed: 'The game night is finished.',
    unavailable: 'This game night is no longer available.', title: name => `**Game Night: ${name}**`,
    host: creatorId => `Host: <@${creatorId}>`, expiry: unixSeconds => `Expires: <t:${unixSeconds}:R>`,
    nominationHeading: 'Nominations', noNominations: 'No games have been nominated yet.',
    nominatingState: 'State: accepting nominations', votingState: 'State: voting is open', finishedState: 'State: finished',
    expiredState: 'State: expired without a selection', tonight: game => `Tonight: **${game}**`,
    tieResolved: games => `Tiebreak recorded between: ${games}.`,
    voteLine: (position, game, votes) => `${position}. **${game}** - ${votes} ${votes === 1 ? 'vote' : 'votes'}`,
    nominationLine: (position, game) => `${position}. **${game}**`, openVotingButton: 'Open voting', pickWinnerButton: 'Pick winner',
    error: code => ({
        'active-session-exists': 'This server already has an active game night.', 'duplicate-nomination': 'That game has already been nominated.',
        expired: 'This game night has expired.', 'invalid-duration': 'Duration must be between 1 and 24 hours.',
        'invalid-name': 'Names must contain visible text and be no longer than 80 characters.',
        'nomination-limit': 'This game night already has five nominations.', 'not-creator': 'Only the game night host can do that.',
        'not-found': 'There is no active game night here.', 'not-nominating': 'This game night is no longer accepting nominations.',
        'not-voting': 'Voting is not open for this game night.', 'own-nomination-exists': 'You have already nominated a game for this game night.',
        'too-few-nominations': 'At least two nominations are required before voting can open.',
        'wrong-channel': 'Use the channel containing the active Game Night Board.',
    })[code],
};

const dutch: GameNightCopy = {
    command: {
        start: 'Start een nieuwe spelavond in dit kanaal', startName: 'Een korte naam voor deze spelavond',
        duration: 'Uren voordat een onvoltooide spelavond verloopt', nominate: 'Nomineer één spel voor de actieve spelavond',
        game: 'Het spel dat je wilt nomineren', open: 'Open de stemming over de nominaties', close: 'Sluit de stemming en kies de winnaar',
        status: 'Toon de huidige status van de spelavond',
    },
    guildOnly: 'Het spelavondbord is alleen beschikbaar op een server.',
    nominated: game => `**${game}** is genomineerd.`, votingOpened: 'De stemming is geopend.', closed: 'De spelavond is afgerond.',
    unavailable: 'Deze spelavond is niet meer beschikbaar.', title: name => `**Spelavond: ${name}**`,
    host: creatorId => `Host: <@${creatorId}>`, expiry: unixSeconds => `Verloopt: <t:${unixSeconds}:R>`,
    nominationHeading: 'Nominaties', noNominations: 'Er zijn nog geen spellen genomineerd.',
    nominatingState: 'Status: nominaties worden geaccepteerd', votingState: 'Status: de stemming is geopend', finishedState: 'Status: afgerond',
    expiredState: 'Status: verlopen zonder keuze', tonight: game => `Vanavond: **${game}**`,
    tieResolved: games => `Vastgelegde loting tussen: ${games}.`,
    voteLine: (position, game, votes) => `${position}. **${game}** - ${votes} ${votes === 1 ? 'stem' : 'stemmen'}`,
    nominationLine: (position, game) => `${position}. **${game}**`, openVotingButton: 'Stemming openen', pickWinnerButton: 'Winnaar kiezen',
    error: code => ({
        'active-session-exists': 'Deze server heeft al een actieve spelavond.', 'duplicate-nomination': 'Dat spel is al genomineerd.',
        expired: 'Deze spelavond is verlopen.', 'invalid-duration': 'De duur moet tussen 1 en 24 uur liggen.',
        'invalid-name': 'Namen moeten zichtbare tekst bevatten en mogen maximaal 80 tekens lang zijn.',
        'nomination-limit': 'Deze spelavond heeft al vijf nominaties.', 'not-creator': 'Alleen de host van de spelavond kan dit doen.',
        'not-found': 'Er is hier geen actieve spelavond.', 'not-nominating': 'Deze spelavond accepteert geen nominaties meer.',
        'not-voting': 'De stemming voor deze spelavond is niet geopend.', 'own-nomination-exists': 'Je hebt al een spel voor deze spelavond genomineerd.',
        'too-few-nominations': 'Er zijn minstens twee nominaties nodig om de stemming te openen.',
        'wrong-channel': 'Gebruik het kanaal met het actieve spelavondbord.',
    })[code],
};

export function getGameNightCopy(locale: SupportedOutputLocale): GameNightCopy {
    return resolveLocaleValue(locale, { en: english, nl: dutch } satisfies OutputLocaleValues<GameNightCopy>);
}

export const gameNightCopy = english;
