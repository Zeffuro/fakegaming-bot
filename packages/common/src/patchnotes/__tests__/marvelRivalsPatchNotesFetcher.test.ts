import { afterEach, describe, it, expect, vi } from 'vitest';
import { MarvelRivalsPatchNotesFetcher } from '../marvelRivalsPatchNotesFetcher.js';

const html = `
<div class="cont-box">
  <a class="list-item" href="/gameupdate/20241231.html">
    <img src="https://img/mrv.png" />
    <div class="text">
      <h2>Version 20241231 Update</h2>
      <p>Patch details...</p>
    </div>
  </a>
</div>`;

describe('MarvelRivalsPatchNotesFetcher.parsePatchNotes', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('parses versioned list item', () => {
        const fetcher = new MarvelRivalsPatchNotesFetcher();
        const note = fetcher.parsePatchNotes(html);
        expect(note).not.toBeNull();
        expect(note?.game).toBe('Marvel Rivals');
        expect(note?.version).toBe('20241231');
        expect(note?.url).toBe('https://www.marvelrivals.com/gameupdate/20241231.html');
        expect(note?.imageUrl).toBe('https://img/mrv.png');
    });

    it('fetches full article body from artText', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            text: vi.fn().mockResolvedValue(`
                <div class="artText">
                    <p>Greetings, Rivals!</p>
                    <h2>Fixes and Optimizations</h2>
                    <p>1. Hero fix<br>2. Other fix</p>
                    <p><a>Discord</a>|<a>X</a>|<a>Facebook</a>|<a>Instagram</a>|<a>TikTok</a>|<a>YouTube</a>|<a>Twitch</a></p>
                </div>
            `)
        }));
        const fetcher = new MarvelRivalsPatchNotesFetcher();

        const full = await fetcher.fetchFullPatchContent('https://www.marvelrivals.com/gameupdate/20241231.html');

        expect(full?.content).toContain('Greetings, Rivals!');
        expect(full?.content).toContain('**Fixes and Optimizations**');
        expect(full?.content).not.toContain('Discord|X|Facebook');
    });
});
