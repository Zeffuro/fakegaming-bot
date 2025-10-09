import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { setupModelMocks } from '@zeffuro/fakegaming-common/testing';
import { OverwatchPatchNotesFetcher } from '../overwatchPatchNotesFetcher.js';

beforeAll(() => {
    setupModelMocks();
});

describe('OverwatchPatchNotesFetcher', () => {
    let fetcher: OverwatchPatchNotesFetcher;

    beforeEach(() => {
        fetcher = new OverwatchPatchNotesFetcher();
    });

    describe('constructor', () => {
        it('should initialize with correct game name', () => {
            expect(fetcher.game).toBe('Overwatch 2');
        });
    });

    describe('getPatchNotesUrl', () => {
        it('should return the correct patch notes URL', () => {
            const url = fetcher.getPatchNotesUrl();
            expect(url).toBe('https://overwatch.blizzard.com/en-us/news/patch-notes/');
        });
    });

    describe('parsePatchNotes', () => {
        it('should parse valid patch notes HTML', () => {
            const mockHtml = `
                <html>
                    <body>
                        <div class="PatchNotes-patch PatchNotes-live">
                            <div class="PatchNotes-date">March 6, 2024</div>
                            <div class="PatchNotes-patchTitle">March 6, 2024 - Hero Balance Updates</div>
                            <div class="PatchNotes-sectionTitle">Balance Changes</div>
                            <div class="PatchNotes-sectionDescription">Tracer damage increased.</div>
                            <div class="PatchNotes-sectionDescription">Genji health increased.</div>
                        </div>
                    </body>
                </html>
            `;

            const result = fetcher.parsePatchNotes(mockHtml);

            expect(result).not.toBeNull();
            expect(result?.game).toBe('Overwatch 2');
            expect(result?.title).toBe('March 6, 2024');
            expect(result?.content).toContain('**Balance Changes**');
            expect(result?.content).toContain('Tracer damage increased.');
            expect(result?.content).toContain('Genji health increased.');
            expect(result?.url).toBe('https://overwatch.blizzard.com/en-us/news/patch-notes/');
        });

        it('should handle patch notes without section title', () => {
            const mockHtml = `
                <html>
                    <body>
                        <div class="PatchNotes-patch PatchNotes-live">
                            <div class="PatchNotes-date">March 6, 2024</div>
                            <div class="PatchNotes-patchTitle">March 6, 2024</div>
                            <div class="PatchNotes-sectionDescription">Bug fixes applied.</div>
                        </div>
                    </body>
                </html>
            `;

            const result = fetcher.parsePatchNotes(mockHtml);

            expect(result).not.toBeNull();
            expect(result?.content).toBe('Bug fixes applied.');
        });

        it('should return null when no live patch found', () => {
            const mockHtml = '<html><body><div class="PatchNotes-patch"></div></body></html>';
            const result = fetcher.parsePatchNotes(mockHtml);
            expect(result).toBeNull();
        });

        it('should return null when date is invalid', () => {
            const mockHtml = `
                <html>
                    <body>
                        <div class="PatchNotes-patch PatchNotes-live">
                            <div class="PatchNotes-date">Invalid Date</div>
                            <div class="PatchNotes-patchTitle">Patch Title</div>
                            <div class="PatchNotes-sectionDescription">Content</div>
                        </div>
                    </body>
                </html>
            `;

            const result = fetcher.parsePatchNotes(mockHtml);
            expect(result).toBeNull();
        });

        it('should return null when title is missing', () => {
            const mockHtml = `
                <html>
                    <body>
                        <div class="PatchNotes-patch PatchNotes-live">
                            <div class="PatchNotes-date">March 6, 2024</div>
                            <div class="PatchNotes-sectionDescription">Content</div>
                        </div>
                    </body>
                </html>
            `;

            const result = fetcher.parsePatchNotes(mockHtml);
            expect(result).toBeNull();
        });

        it('should extract date from complex title format', () => {
            const mockHtml = `
                <html>
                    <body>
                        <div class="PatchNotes-patch PatchNotes-live">
                            <div class="PatchNotes-date">December 15, 2024</div>
                            <div class="PatchNotes-patchTitle">December 15, 2024 - Season 14 Balance Update</div>
                            <div class="PatchNotes-sectionDescription">Content here.</div>
                        </div>
                    </body>
                </html>
            `;

            const result = fetcher.parsePatchNotes(mockHtml);

            expect(result).not.toBeNull();
            expect(result?.title).toBe('December 15, 2024');
        });
    });
});
