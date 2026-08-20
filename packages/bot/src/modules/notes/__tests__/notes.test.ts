import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInputCommandInteraction, MessageContextMenuCommandInteraction } from 'discord.js';
import { createMockConfigManager, expectReplyTextContains, setupCommandTest } from '@zeffuro/fakegaming-common/testing';

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
    const setDefaultLocale = (): void => {
        vi.mocked(createMockConfigManager({}).guildLocaleConfigManager.getOutputLocale).mockResolvedValue('en');
    };
    beforeEach(setDefaultLocale);
    afterEach(setDefaultLocale);
    it('localizes list chrome while preserving note content', async () => {
        const { command, interaction } = await setupCommandTest(
            'modules/notes/commands/notes.js',
            {
                interaction: { subcommand: 'list', guildId: 'guild-nl' },
                managerOverrides: {
                    userNoteManager: { listForUser: vi.fn().mockResolvedValue(notes) },
                    guildLocaleConfigManager: { getOutputLocale: vi.fn().mockResolvedValue('nl') },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);
        expectReplyTextContains(interaction, 'Je notities:');
        expectReplyTextContains(interaction, '[vastgezet] Pinned note');
        expectReplyTextContains(interaction, 'Pinned body');
    });

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
            locale: 'en',
        });
        expectReplyTextContains(interaction, 'Saved note `cccccccc`');
    });

    it('passes the stored Dutch locale when creating a note', async () => {
        const createForUser = vi.fn().mockResolvedValue({
            id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
            title: 'Notitie-inhoud',
        });
        const {command, interaction} = await setupCommandTest('modules/notes/commands/notes.js', {
            interaction: {
                subcommand: 'add',
                guildId: 'guild-nl',
                stringOptions: {body: 'Notitie-inhoud'},
            },
            managerOverrides: {
                guildLocaleConfigManager: {getOutputLocale: vi.fn().mockResolvedValue('nl')},
                userNoteManager: {createForUser},
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(createForUser).toHaveBeenCalledWith(expect.objectContaining({locale: 'nl'}));
        expectReplyTextContains(interaction, 'Notitie `dddddddd` opgeslagen');
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

describe('Save to Notes message context command', () => {
    it('saves a private note with a bounded excerpt and jump link', async () => {
        const createForUser = vi.fn().mockResolvedValue({id: 'cccccccc-cccc-cccc-cccc-cccccccccccc'});
        const { command, interaction } = await setupCommandTest(
            'modules/notes/commands/saveMessageToNotes.js',
            {
                interaction: {
                    guildId: 'guild-1',
                    user: { id: '123456789012345678' },
                    targetMessage: {
                        id: 'message-1',
                        channelId: 'channel-1',
                        content: '<@&role> ' + 'x'.repeat(1600),
                        url: 'https://discord.com/channels/guild-1/channel-1/message-1',
                        attachments: { size: 0 },
                        stickers: { size: 0 },
                    },
                },
                managerOverrides: { userNoteManager: { createForUser } },
            }
        );

        await command.execute(interaction as unknown as MessageContextMenuCommandInteraction);

        expect(createForUser).toHaveBeenCalledWith(expect.objectContaining({
            discordId: '123456789012345678',
            title: 'Saved message',
            body: expect.stringContaining('Source: https://discord.com/channels/guild-1/channel-1/message-1'),
        }));
        const body = createForUser.mock.calls[0]?.[0].body as string;
        expect(body).toContain('...');
        expect(body).not.toContain('x'.repeat(1600));
        expectReplyTextContains(interaction, 'Saved this message to your private notes');
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({allowedMentions: {parse: []}}));
    });

    it('saves attachment-only messages in DMs without downloading them', async () => {
        const createForUser = vi.fn().mockResolvedValue({id: 'dddddddd-1111-2222-3333-444444444444'});
        const { command, interaction } = await setupCommandTest(
            'modules/notes/commands/saveMessageToNotes.js',
            {
                interaction: {
                    guildId: null,
                    user: { id: 'dm-user' },
                    targetMessage: {
                        id: 'message-2',
                        channelId: 'dm-channel',
                        content: '',
                        attachments: { size: 1 },
                        stickers: { size: 0 },
                    },
                },
                managerOverrides: { userNoteManager: { createForUser } },
            }
        );

        await command.execute(interaction as unknown as MessageContextMenuCommandInteraction);

        expect(createForUser).toHaveBeenCalledWith(expect.objectContaining({
            discordId: 'dm-user',
            body: expect.stringContaining('[Message contains 1 attachment; files were not downloaded.]'),
        }));
        expect(createForUser.mock.calls[0]?.[0].body).toContain('/@me/dm-channel/message-2');
    });

    it('reports manager failures without leaking message content', async () => {
        const createForUser = vi.fn().mockRejectedValue(new Error('database unavailable'));
        const { command, interaction } = await setupCommandTest(
            'modules/notes/commands/saveMessageToNotes.js',
            {
                interaction: {
                    guildId: 'guild-1',
                    user: { id: 'user-1' },
                    targetMessage: { id: 'message-3', channelId: 'channel-1', content: 'secret content' },
                },
                managerOverrides: { userNoteManager: { createForUser } },
            }
        );

        await command.execute(interaction as unknown as MessageContextMenuCommandInteraction);

        expectReplyTextContains(interaction, 'could not save');
        const replyContent = (interaction.reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.content as string;
        expect(replyContent).not.toContain('secret content');
    });
});
