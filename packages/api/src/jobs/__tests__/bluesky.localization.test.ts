import { describe, expect, it } from 'vitest';
import { buildBlueskyEmbedAndContent } from '../bluesky.js';

describe('Bluesky notification localization', () => {
    it('localizes application framing and preserves provider content', () => {
        const result = buildBlueskyEmbedAndContent({
            locale: 'nl',
            post: {
                uri: 'at://did:plc:test/app.bsky.feed.post/post-1',
                cid: 'cid-1',
                author: {
                    did: 'did:plc:test',
                    handle: 'creator.example',
                    displayName: 'Creator Name',
                },
                record: {
                    text: 'Provider-authored post text',
                    createdAt: '2026-08-20T08:00:00.000Z',
                },
                likeCount: 1234,
                repostCount: 25,
                replyCount: 6,
            },
        });
        const serialized = JSON.stringify(result.payload);

        expect(result.content).toContain('nieuw Bluesky-bericht van Creator Name');
        expect(serialized).toContain('Creator Name heeft iets op Bluesky geplaatst');
        expect(serialized).toContain('Provider-authored post text');
        expect(serialized).toContain('Vind-ik-leuks');
        expect(serialized).toContain('1.234');
        expect(serialized).toContain('Bericht bekijken');
    });
});
