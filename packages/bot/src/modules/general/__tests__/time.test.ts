import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {ChatInputCommandInteraction, AutocompleteInteraction} from 'discord.js';
import {setupCommandTest, expectReplyTextContains} from '@zeffuro/fakegaming-common/testing';
import {parseTimeInput} from '../commands/time.js';

describe('time command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('parses a wall-clock time in a timezone', () => {
        const parsed = parseTimeInput('2026-06-11 20:30', 'Europe/Amsterdam', new Date('2026-06-11T10:00:00Z'));

        expect(parsed?.toISOString()).toBe('2026-06-11T18:30:00.000Z');
    });

    it('parses same-day HH:mm in the provided timezone', () => {
        const parsed = parseTimeInput('20:30', 'Europe/Amsterdam', new Date('2026-06-11T10:00:00Z'));

        expect(parsed?.toISOString()).toBe('2026-06-11T18:30:00.000Z');
    });

    it('uses the saved user timezone when no timezone option is provided', async () => {
        const getUser = vi.fn().mockResolvedValue({timezone: 'Europe/Amsterdam'});
        const {command, interaction} = await setupCommandTest(
            'modules/general/commands/time.js',
            {
                interaction: {
                    stringOptions: {time: '2026-06-11 20:30'},
                    user: {id: '123456789012345678'},
                },
                managerOverrides: {
                    userManager: {getUser},
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getUser).toHaveBeenCalledWith({discordId: '123456789012345678'});
        expectReplyTextContains(interaction, 'Input: `2026-06-11 20:30` in `Europe/Amsterdam`');
        expectReplyTextContains(interaction, 'Copy: `<t:1781202600:F>`');
        expectReplyTextContains(interaction, 'Relative: <t:1781202600:R>');
    });

    it('uses the explicit timezone option over the saved timezone', async () => {
        const {command, interaction} = await setupCommandTest(
            'modules/general/commands/time.js',
            {
                interaction: {
                    stringOptions: {time: '2026-06-11 20:30', timezone: 'UTC'},
                    user: {id: '123456789012345678'},
                },
                managerOverrides: {
                    userManager: {getUser: vi.fn().mockResolvedValue({timezone: 'Europe/Amsterdam'})},
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Input: `2026-06-11 20:30` in `UTC`');
        expectReplyTextContains(interaction, 'Copy: `<t:1781209800:F>`');
    });

    it('accepts Unix timestamps', async () => {
        const {command, interaction} = await setupCommandTest(
            'modules/general/commands/time.js',
            {
                interaction: {
                    stringOptions: {time: '1781202600', timezone: 'UTC'},
                },
                managerOverrides: {
                    userManager: {getUser: vi.fn()},
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Copy: `<t:1781202600:F>`');
    });

    it('rejects invalid times', async () => {
        const {command, interaction} = await setupCommandTest(
            'modules/general/commands/time.js',
            {
                interaction: {
                    stringOptions: {time: 'not a time', timezone: 'UTC'},
                },
                managerOverrides: {
                    userManager: {getUser: vi.fn()},
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Invalid time.');
    });

    it('returns timezone suggestions for autocomplete', async () => {
        const {command} = await setupCommandTest('modules/general/commands/time.js', {});
        const interaction = {
            options: {
                getFocused: vi.fn().mockReturnValue('Amsterdam'),
            },
            respond: vi.fn().mockResolvedValue(undefined),
        };

        await command.autocomplete(interaction as unknown as AutocompleteInteraction);

        expect(interaction.respond).toHaveBeenCalledWith(
            expect.arrayContaining([{name: 'Europe/Amsterdam', value: 'Europe/Amsterdam'}])
        );
    });
});
