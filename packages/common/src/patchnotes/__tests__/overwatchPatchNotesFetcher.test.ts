import { describe, it, expect } from 'vitest';
import { OverwatchPatchNotesFetcher } from '../overwatchPatchNotesFetcher.js';
import { parseDateToISO } from '../../utils/time.js';

const html = `
<div class="PatchNotes-patch PatchNotes-live">
  <div class="PatchNotes-date">August 2, 2024</div>
  <div class="PatchNotes-patchTitle">Overwatch 2 Retail Patch Notes - August 2, 2024</div>
  <div class="PatchNotes-sectionTitle">General Updates</div>
  <div class="PatchNotes-sectionDescription">Update A</div>
  <div class="PatchNotes-sectionDescription">Update B</div>
</div>`;

describe('OverwatchPatchNotesFetcher.parsePatchNotes', () => {
    it('parses patch note info and formats content', () => {
        const fetcher = new OverwatchPatchNotesFetcher();
        const note = fetcher.parsePatchNotes(html);
        expect(note).not.toBeNull();
        expect(note?.game).toBe('Overwatch 2');
        expect(note?.title).toBe('August 2, 2024');
        const expectedIso = parseDateToISO('August 2, 2024');
        expect(note?.version).toBe(expectedIso);
        expect(note?.content).toContain('**General Updates**');
        expect(note?.content).toContain('Update A');
        expect(note?.url).toBe(fetcher.getPatchNotesUrl());
    });
});
