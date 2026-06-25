import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import { renderQuoteCard } from '@zeffuro/fakegaming-common/quote-card';

vi.mock('@zeffuro/fakegaming-common/quote-card', () => ({
    buildQuoteCardFilename: vi.fn((quoteId: string) => `quote-card-${quoteId}.png`),
    renderQuoteCard: vi.fn(() => Buffer.from('fake-png')),
}));

vi.mock('discord.js', async (importOriginal) => {
    const actual = await importOriginal();
    return Object.assign({}, actual, {
        AttachmentBuilder: vi.fn().mockImplementation((_buffer: Buffer, options: { name: string }) => ({
            name: options.name,
        })),
    });
});

const quoteRows = [
    {
        id: 'quote-one',
        guildId: 'guild',
        quote: 'First approved quote',
        authorId: 'author-1',
        submitterId: 'submitter-1',
        timestamp: 1700000000000,
        tags: '["raid-night"]',
        source: 'voice chat',
        context: 'before pull',
        moderationStatus: 'approved',
    },
    {
        id: 'quote-two',
        guildId: 'guild',
        quote: 'Pending quote',
        authorId: 'author-2',
        submitterId: 'submitter-2',
        timestamp: 1700000000001,
        moderationStatus: 'pending',
    },
];

describe('quoteCard command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders a specific approved quote card', async () => {
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/quoteCard.js',
            {
                interaction: {
                    stringOptions: { id: 'quote-one' },
                    guildId: 'guild',
                },
                managerOverrides: {
                    quoteManager: {
                        getQuotesByGuild: vi.fn().mockResolvedValue(quoteRows),
                    },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(renderQuoteCard).toHaveBeenCalledWith(expect.objectContaining({
            quote: 'First approved quote',
            authorId: 'author-1',
            tags: ['raid-night'],
            source: 'voice chat',
            context: 'before pull',
            guildName: 'Test Guild',
        }));
        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
            content: 'Quote card for <@author-1>',
            files: [expect.objectContaining({ name: 'quote-card-quote-one.png' })],
        }));
    });

    it('does not render pending quote cards', async () => {
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/quoteCard.js',
            {
                interaction: {
                    stringOptions: { id: 'quote-two' },
                    guildId: 'guild',
                },
                managerOverrides: {
                    quoteManager: {
                        getQuotesByGuild: vi.fn().mockResolvedValue(quoteRows),
                    },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(renderQuoteCard).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('not approved yet'));
    });
});
