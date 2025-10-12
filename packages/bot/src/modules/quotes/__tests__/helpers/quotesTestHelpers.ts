import { expect } from 'vitest';
import { expectReplyTextContains } from '@zeffuro/fakegaming-common/testing';

/**
 * Assert that a spy for getQuotesByAuthor was called with the expected guild and author.
 */
export function assertGetByAuthorCalled(spy: unknown, guildId: string, authorId: string): void {
    expect(spy).toHaveBeenCalledWith(guildId, authorId);
}

/**
 * Assert that a spy for getQuotesByGuild was called with the expected guild.
 */
export function assertGetByGuildCalled(spy: unknown, guildId: string): void {
    expect(spy).toHaveBeenCalledWith(guildId);
}

/**
 * Assert that a spy for searchQuotes was called with the expected guild and text.
 */
export function assertSearchCalled(spy: unknown, guildId: string, text: string): void {
    expect(spy).toHaveBeenCalledWith(guildId, text);
}

/**
 * Expect that the reply text contains all provided substrings.
 */
export function expectReplyContains(interaction: unknown, parts: string[]): void {
    for (const p of parts) {
        expectReplyTextContains(interaction, p);
    }
}
