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
            localizations: { nl: { description: 'Testcommando' } },
        }, builder => builder.addStringOption(option => option.setName('value').setDescription('Value')));
        const json = command.toJSON();
        expect(json.name_localizations).toBeUndefined();
        expect(json.description_localizations?.nl).toBe('Testcommando');
        expect(json.options?.[0]?.name).toBe('value');
    });

    it('keeps context command names canonical', () => {
        const user = createUserContextCommand({ name: 'Inspect' }).toJSON();
        const message = createMessageContextCommand({ name: 'Save Quote' }).toJSON();
        expect(user.name_localizations).toBeUndefined();
        expect(message.name_localizations).toBeUndefined();
    });

    it('only accepts boolean testOnly metadata', () => {
        expect(getTestOnly({ testOnly: true })).toBe(true);
        expect(getTestOnly({ testOnly: false })).toBe(false);
        expect(getTestOnly({ testOnly: 'true' })).toBe(false);
        expect(getTestOnly({})).toBe(false);
    });
});
