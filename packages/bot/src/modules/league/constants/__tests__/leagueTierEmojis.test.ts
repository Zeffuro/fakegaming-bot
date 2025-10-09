import { describe, it, expect, vi } from 'vitest';
import type { Guild } from 'discord.js';

vi.mock('../../../../core/applicationEmojiManager.js', () => ({
    getAppEmojiId: vi.fn((name: string) => (name.toLowerCase() === 'lolgold' ? '1234567890' : undefined)),
}));

import { getTierEmoji } from '../leagueTierEmojis.js';

function makeGuildWithEmoji(name: string): Guild {
    const fakeEmoji = { name, toString: () => `<:${name}:999>` } as any;
    const guild = {
        emojis: {
            cache: {
                find: (pred: (e: { name?: string }) => boolean) => (pred(fakeEmoji) ? fakeEmoji : undefined),
            },
        },
    } as unknown as Guild;
    return guild;
}

describe('getTierEmoji', () => {
    it('returns guild emoji mention when available', () => {
        const guild = makeGuildWithEmoji('lolgold');
        const out = getTierEmoji(guild, 'GOLD');
        expect(out).toBe('<:lolgold:999>');
    });

    it('falls back to app emoji ID when guild emoji missing', () => {
        const guild = makeGuildWithEmoji('someother');
        const out = getTierEmoji(guild, 'GOLD');
        expect(out).toBe('<:lolgold:1234567890>');
    });

    it('returns empty string when no emoji found', () => {
        const guild = makeGuildWithEmoji('someother');
        const out = getTierEmoji(guild, 'MASTER');
        expect(out).toBe('');
    });
});
