import {createTranslator} from 'use-intl/core';
import {describe, expect, it} from 'vitest';
import enAnime from '../../messages/en/anime.json' with {type: 'json'};
import enBirthday from '../../messages/en/birthday.json' with {type: 'json'};
import enGameNight from '../../messages/en/game-night.json' with {type: 'json'};
import enGeneral from '../../messages/en/general.json' with {type: 'json'};
import enLeague from '../../messages/en/league.json' with {type: 'json'};
import enNotes from '../../messages/en/notes.json' with {type: 'json'};
import enQuestion from '../../messages/en/question.json' with {type: 'json'};
import enQuotes from '../../messages/en/quotes.json' with {type: 'json'};
import enReminders from '../../messages/en/reminders.json' with {type: 'json'};
import enSubscriptions from '../../messages/en/subscriptions.json' with {type: 'json'};
import nlAnime from '../../messages/nl/anime.json' with {type: 'json'};
import nlBirthday from '../../messages/nl/birthday.json' with {type: 'json'};
import nlGameNight from '../../messages/nl/game-night.json' with {type: 'json'};
import nlGeneral from '../../messages/nl/general.json' with {type: 'json'};
import nlLeague from '../../messages/nl/league.json' with {type: 'json'};
import nlNotes from '../../messages/nl/notes.json' with {type: 'json'};
import nlQuestion from '../../messages/nl/question.json' with {type: 'json'};
import nlQuotes from '../../messages/nl/quotes.json' with {type: 'json'};
import nlReminders from '../../messages/nl/reminders.json' with {type: 'json'};
import nlSubscriptions from '../../messages/nl/subscriptions.json' with {type: 'json'};
import {getOutputLocaleMetadata, type SupportedOutputLocale} from '../localization.js';
import {BOT_RUNTIME_MESSAGES} from '../runtimeCopy.js';

const ICU_ARGUMENT = /\{([a-zA-Z][a-zA-Z0-9_]*)\s*(?:,|\})/g;
const BOT_RENDERED_MESSAGES = {
    en: {
        ...BOT_RUNTIME_MESSAGES.en,
        'copy/anime': enAnime,
        'copy/birthday': enBirthday,
        'copy/game-night': enGameNight,
        'copy/general': enGeneral,
        'copy/league': enLeague,
        'copy/notes': enNotes,
        'copy/question': enQuestion,
        'copy/quotes': enQuotes,
        'copy/reminders': enReminders,
        'copy/subscriptions': enSubscriptions,
    },
    nl: {
        ...BOT_RUNTIME_MESSAGES.nl,
        'copy/anime': nlAnime,
        'copy/birthday': nlBirthday,
        'copy/game-night': nlGameNight,
        'copy/general': nlGeneral,
        'copy/league': nlLeague,
        'copy/notes': nlNotes,
        'copy/question': nlQuestion,
        'copy/quotes': nlQuotes,
        'copy/reminders': nlReminders,
        'copy/subscriptions': nlSubscriptions,
    },
};

function leafMessages(messages: Readonly<Record<string, unknown>>, prefix = ''): Array<[string, string]> {
    return Object.entries(messages).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof value === 'string'
            ? [[path, value]]
            : leafMessages(value as Readonly<Record<string, unknown>>, path);
    });
}

describe('bot runtime catalogs', () => {
    it('keeps locale domains and message keys in parity', () => {
        expect(Object.keys(BOT_RENDERED_MESSAGES.nl).sort()).toEqual(Object.keys(BOT_RENDERED_MESSAGES.en).sort());
        for (const domain of Object.keys(BOT_RENDERED_MESSAGES.en) as Array<keyof typeof BOT_RENDERED_MESSAGES.en>) {
            expect(leafMessages(BOT_RENDERED_MESSAGES.nl[domain]).map(([key]) => key).sort())
                .toEqual(leafMessages(BOT_RENDERED_MESSAGES.en[domain]).map(([key]) => key).sort());
        }
    });

    it.each(['en', 'nl'] satisfies SupportedOutputLocale[])('renders every %s message without ICU errors', locale => {
        const errors: unknown[] = [];
        const catalogs = BOT_RENDERED_MESSAGES[locale];

        for (const [domain, messages] of Object.entries(catalogs)) {
            const translate = createTranslator({
                locale: getOutputLocaleMetadata(locale).formatTag,
                messages,
                onError: error => errors.push({domain, error}),
            });
            for (const [key, message] of leafMessages(messages)) {
                const values = Object.fromEntries(
                    Array.from(message.matchAll(ICU_ARGUMENT), match => [match[1]!, 2]),
                );
                const rendered = translate(key as never, values as never);
                expect(rendered, `${locale}.${domain}.${key}`).toBeTypeOf('string');
                expect(rendered.length, `${locale}.${domain}.${key}`).toBeGreaterThan(0);
            }
        }

        expect(errors).toEqual([]);
    });
});
