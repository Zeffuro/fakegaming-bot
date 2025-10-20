import { describe, it, expect } from 'vitest';
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
    it('parses versioned list item', () => {
        const fetcher = new MarvelRivalsPatchNotesFetcher();
        const note = fetcher.parsePatchNotes(html);
        expect(note).not.toBeNull();
        expect(note?.game).toBe('Marvel Rivals');
        expect(note?.version).toBe('20241231');
        expect(note?.url).toBe('https://www.marvelrivals.com/gameupdate/20241231.html');
        expect(note?.imageUrl).toBe('https://img/mrv.png');
    });
});

