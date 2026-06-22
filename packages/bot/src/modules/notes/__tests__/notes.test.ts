import { describe, expect, it, vi } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import { expectReplyTextContains, setupCommandTest } from '@zeffuro/fakegaming-common/testing';

const notes = [
    {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        discordId: '123456789012345678',
        title: 'Pinned note',
        body: 'Pinned body',
        pinned: true,
    },
    {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        discordId: '123456789012345678',
        title: 'Second note',
        body: 'Second body',
        pinned: false,
    },
];

describe('notes command', () => {
    it('adds a note with an optional title', async () => {
        const createForUser = vi.fn().mockResolvedValue({
            id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            discordId: '123456789012345678',
            title: 'Command body',
            body: 'Command body',
            pinned: false,
        });
        const { command, interaction } = await setupCommandTest(
            'modules/notes/commands/notes.js',
            {
                interaction: {
                    subcommand: 'add',
                    stringOptions: { body: 'Command body' },
                    booleanOptions: { pinned: false },
                },
                managerOverrides: {
                    userNoteManager: { createForUser },
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(createForUser).toHaveBeenCalledWith({
            discordId: '123456789012345678',
            body: 'Command body',
            pinned: false,
        });
        expectReplyTextContains(interaction, 'Saved note `cccccccc`');
    });

    it('lists saved notes for the user', async () => {
        const { command, interaction } = await setupCommandTest(
            'modules/notes/commands/notes.js',
            {
                interaction: { subcommand: 'list' },
                managerOverrides: {
                    userNoteManager: { listForUser: vi.fn().mockResolvedValue(notes) },
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Your notes:');
        expectReplyTextContains(interaction, '`aaaaaaaa` [pinned] Pinned note');
        expectReplyTextContains(interaction, 'Second body');
    });

    it('shows a note by short id', async () => {
        const { command, interaction } = await setupCommandTest(
            'modules/notes/commands/notes.js',
            {
                interaction: {
                    subcommand: 'show',
                    stringOptions: { note: 'bbbbbbbb' },
                },
                managerOverrides: {
                    userNoteManager: { listForUser: vi.fn().mockResolvedValue(notes) },
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, '**Second note**');
        expectReplyTextContains(interaction, 'Second body');
    });

    it('deletes a note by list number', async () => {
        const removeForUser = vi.fn().mockResolvedValue(true);
        const { command, interaction } = await setupCommandTest(
            'modules/notes/commands/notes.js',
            {
                interaction: {
                    subcommand: 'delete',
                    stringOptions: { note: '2' },
                },
                managerOverrides: {
                    userNoteManager: {
                        listForUser: vi.fn().mockResolvedValue(notes),
                        removeForUser,
                    },
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(removeForUser).toHaveBeenCalledWith('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '123456789012345678');
        expectReplyTextContains(interaction, 'Deleted note `bbbbbbbb`');
    });
});
