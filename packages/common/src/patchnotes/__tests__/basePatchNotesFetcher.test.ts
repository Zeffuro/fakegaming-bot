import { describe, it, expect } from 'vitest';
import { BasePatchNotesFetcher } from '../basePatchNotesFetcher.js';
import { PatchNoteConfig } from '../../models/index.js';

class TestFetcher extends BasePatchNotesFetcher<string> {
    constructor(private raws: Array<{ title: string; version?: string }>, private full?: { content: string; fullImage?: string } | null) {
        super('TestGame', 0x123456);
    }
    getPatchNotesUrl(): string {
        return 'https://example.com/test';
    }
    async fetchRawData(): Promise<string[]> {
        return this.raws.map((r) => JSON.stringify(r));
    }
    parsePatchNotes(raw: string): PatchNoteConfig | null {
        const data = JSON.parse(raw) as { title: string; version?: string };
        if (!data.title) return null;
        return PatchNoteConfig.build({
            game: this.game,
            title: data.title,
            content: `content for ${data.title}`,
            url: 'https://example.com/patch',
            publishedAt: Date.now(),
            version: data.version,
            imageUrl: undefined,
            logoUrl: undefined,
        });
    }
    protected async fetchFullPatchContent(_url: string) {
        return this.full ?? null;
    }
}

describe('BasePatchNotesFetcher.fetchLatestPatchNote', () => {
    it('returns null when no newer version than stored', async () => {
        const f = new TestFetcher([{ title: 'older', version: '1' }], null);
        const res = await f.fetchLatestPatchNote('2');
        expect(res).toBeNull();
    });

    it('returns latest by version and enriches with accent color and full content', async () => {
        const f = new TestFetcher([
            { title: 'v1', version: '1' },
            { title: 'v2', version: '2' },
        ], { content: 'FULL', fullImage: 'https://img/full.png' });
        const res = await f.fetchLatestPatchNote('1');
        expect(res).not.toBeNull();
        expect(res?.title).toBe('v2');
        expect(res?.version).toBe('2');
        expect(res?.content).toBe('FULL');
        expect(res?.imageUrl).toBe('https://img/full.png');
        expect(res?.accentColor).toBe(0x123456);
    });

    it('handles missing versions by allowing any when storedVersion undefined', async () => {
        const f = new TestFetcher([{ title: 'no-version' }], null);
        const res = await f.fetchLatestPatchNote();
        expect(res?.title).toBe('no-version');
    });
});
