import { describe, expect, it, vi } from 'vitest';
import { ApplicationCommandOptionType, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { parsePresetArguments, presetInteraction, validatePreset } from '../shared/presetExecution.js';
import type { LoadedCommand } from '../../../core/FakegamingBot.js';

function command(): LoadedCommand {
    return { data: { name: 'weather', toJSON: () => ({ options: [
        { name: 'location', type: 3, required: true, max_length: 100 },
        { name: 'days', type: 4, min_value: 1, max_value: 10 },
        { name: 'metric', type: 5 }, { name: 'units', type: 3, choices: [{ value: 'metric' }] },
    ] }) }, execute: vi.fn() };
}

describe('saved command options', () => {
    it('preserves colons and escaped quotes inside quoted values', () => {
        expect(parsePresetArguments('query:"one piece: red" type:movie')).toEqual({ query: 'one piece: red', type: 'movie' });
        expect(parsePresetArguments('location:"New \\"York\\""')).toEqual({ location: 'New "York"' });
        expect(() => parsePresetArguments('query:"unfinished')).toThrow();
    });
    it('parses named options with spaces and validates required values, choices, bounds and types', () => {
        const args = parsePresetArguments('location:New York days:3 metric:true units:metric');
        expect(args).toEqual({ location: 'New York', days: '3', metric: 'true', units: 'metric' });
        expect(validatePreset(command(), 'weather', args)).toContainEqual({ name: 'days', type: 4, value: 3 });
        const invalidInputs: Array<Record<string, string>> = [{}, { location: 'A', days: '1.5' }, { location: 'A', days: '11' },
            { location: 'A', metric: 'yes' }, { location: 'A', units: 'imperial' }, { unknown: 'x', location: 'A' }];
        for (const invalid of invalidInputs) {
            expect(() => validatePreset(command(), 'weather', invalid)).toThrow();
        }
        expect(() => parsePresetArguments('location:A location:B')).toThrow();
        expect(() => validatePreset(command(), 'delete-reminder', { location: 'A' })).toThrow();
    });

    it('executes through an independent options view and forces all output private without mentions', async () => {
        const originalOptions = { getSubcommand: () => 'run', getString: () => 'my weather', getUser: () => ({ id: 'original' }) };
        const interaction = { options: originalOptions, commandName: 'preset', deferred: true,
            editReply: vi.fn(), followUp: vi.fn(), reply: vi.fn(), deferReply: vi.fn(), user: { id: 'owner' }, fetchReply: vi.fn() } as unknown as ChatInputCommandInteraction;
        const wrapped = presetInteraction(interaction, 'weather', [{ name: 'location', type: ApplicationCommandOptionType.String, value: 'Amsterdam' }]);
        expect(wrapped.options.getString('location', true)).toBe('Amsterdam');
        expect(wrapped.options.getUser('user')).toBeNull();
        expect(wrapped.user.id).toBe('owner');
        expect(wrapped.commandName).toBe('weather');
        expect(interaction.commandName).toBe('preset');
        expect(interaction.options.getString('location')).toBe('my weather');
        await wrapped.reply({ content: '@everyone' });
        expect(interaction.editReply).toHaveBeenCalledWith({ content: '@everyone', allowedMentions: { parse: [] } });
        await wrapped.followUp('follow up');
        expect(interaction.followUp).toHaveBeenCalledWith({ content: 'follow up', flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        await wrapped.deferReply();
        expect(interaction.deferReply).not.toHaveBeenCalled();
    });
});
