import { describe, expect, it } from 'vitest';
import {
    createMessageContextCommand,
    createSlashCommand,
    createUserContextCommand,
    getTestOnly,
} from '../commandBuilder.js';

describe('localized command builders', () => {
    it('applies complete slash command metadata and optional options', () => {
        const command = createSlashCommand({
            name: 'test',
            description: 'Test command',
            localizations: { nl: { name: 'testen', description: 'Testcommando' } },
        }, builder => builder.addStringOption(option => option.setName('value').setDescription('Value')));
        const json = command.toJSON();
        expect(json.name_localizations?.nl).toBe('testen');
        expect(json.description_localizations?.nl).toBe('Testcommando');
        expect(json.options?.[0]?.name).toBe('value');
    });

    it('builds context commands with and without translations', () => {
        const localized = createUserContextCommand({
            name: 'inspect',
            localizations: { nl: { name: 'bekijk', description: '' } },
        }).toJSON();
        const plain = createMessageContextCommand({ name: 'quote' }).toJSON();
        expect(localized.name_localizations?.nl).toBe('bekijk');
        expect(plain.name_localizations).toBeUndefined();
    });

    it('only accepts boolean testOnly metadata', () => {
        expect(getTestOnly({ testOnly: true })).toBe(true);
        expect(getTestOnly({ testOnly: false })).toBe(false);
        expect(getTestOnly({ testOnly: 'true' })).toBe(false);
        expect(getTestOnly({})).toBe(false);
    });
});
