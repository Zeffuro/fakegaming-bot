import type { ChatInputCommandInteraction } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import addQuote from '../commands/addQuote.js';
import deleteQuote from '../commands/deleteQuote.js';
import quoteCard from '../commands/quoteCard.js';
import quoteLeaderboard from '../commands/quoteLeaderboard.js';
import quotes from '../commands/quotes.js';
import randomQuote from '../commands/randomQuote.js';
import saveMessageAsQuote from '../commands/saveMessageAsQuote.js';
import searchQuote from '../commands/searchQuote.js';
import showQuotes from '../commands/showQuotes.js';
import getPatchNotes from '../../patchnotes/commands/getPatchNotes.js';
import managePatchNotes from '../../patchnotes/commands/managePatchNotes.js';
import patchnotesHistory from '../../patchnotes/commands/patchnotesHistory.js';
import subscribePatchNotes from '../../patchnotes/commands/subscribePatchNotes.js';

interface LocalizedNode {
    name: string;
    description?: string;
    name_localizations?: Record<string, string> | null;
    description_localizations?: Record<string, string> | null;
    options?: LocalizedNode[];
    choices?: Array<{ name_localizations?: Record<string, string> | null }>;
}

function assertLocalized(node: LocalizedNode): void {
    expect(node.name_localizations?.nl, `${node.name} Dutch name`).toBeTruthy();
    if (node.description !== undefined) {
        expect(node.description_localizations?.nl, `${node.name} Dutch description`).toBeTruthy();
    }
    for (const choice of node.choices ?? []) expect(choice.name_localizations?.nl).toBeTruthy();
    for (const option of node.options ?? []) assertLocalized(option);
}

describe('Quotes and Patch Notes localization', () => {
    it('provides Dutch metadata throughout both command trees', () => {
        const commands = [
            addQuote, deleteQuote, quoteCard, quoteLeaderboard, quotes, randomQuote, saveMessageAsQuote,
            searchQuote, showQuotes, getPatchNotes, managePatchNotes, patchnotesHistory, subscribePatchNotes,
        ];
        for (const command of commands) assertLocalized(command.data.toJSON() as LocalizedNode);
    });

    it('localizes quote search framing while preserving quote text and author', async () => {
        const searchQuotes = vi.fn().mockResolvedValue([{
            quote: 'Provider quote text',
            authorId: 'author-1',
            timestamp: null,
        }]);
        const { command, interaction } = await setupCommandTest('modules/quotes/commands/searchQuote.js', {
            interaction: { stringOptions: { text: 'provider' } },
            managerOverrides: {
                guildLocaleConfigManager: { getOutputLocale: vi.fn().mockResolvedValue('nl') },
                quoteManager: { searchQuotes },
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Citaten die overeenkomen met "provider"'));
        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Provider quote text'));
        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('<@author-1>'));
        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Onbekende datum'));
    });

    it('localizes Patch Notes framing while preserving provider fields', async () => {
        const patch = {
            game: 'ProviderGame',
            title: 'Provider Patch 1.2',
            content: 'Provider-authored balance changes',
            url: 'https://example.com/provider-patch',
            publishedAt: new Date('2026-08-19T12:00:00Z'),
        };
        const { command, interaction } = await setupCommandTest('modules/patchnotes/commands/patchnotesHistory.js', {
            interaction: { stringOptions: { game: 'ProviderGame' }, integerOptions: { count: 1 } },
            managerOverrides: {
                guildLocaleConfigManager: { getOutputLocale: vi.fn().mockResolvedValue('nl') },
                patchNoteHistoryManager: { getHistory: vi.fn().mockResolvedValue([patch]) },
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        const payload = vi.mocked(interaction.reply).mock.calls[0]?.[0] as {
            content: string;
            embeds: Array<{ toJSON(): { title?: string; description?: string; url?: string } }>;
        };
        expect(payload.content).toBe('Opgeslagen patchnote-geschiedenis voor ProviderGame:');
        expect(payload.embeds[0]?.toJSON()).toMatchObject({
            title: 'Provider Patch 1.2',
            description: 'Provider-authored balance changes',
            url: 'https://example.com/provider-patch',
        });
    });
});
