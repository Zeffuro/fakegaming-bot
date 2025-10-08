import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { setupModelMocks } from '@zeffuro/fakegaming-common/testing';
import { MarvelRivalsPatchNotesFetcher } from '../marvelRivalsPatchNotesFetcher.js';

beforeAll(() => {
    setupModelMocks();
});

describe('MarvelRivalsPatchNotesFetcher', () => {
    let fetcher: MarvelRivalsPatchNotesFetcher;

    beforeEach(() => {
        fetcher = new MarvelRivalsPatchNotesFetcher();
    });

    describe('constructor', () => {
        it('should initialize with correct game name', () => {
            expect(fetcher.game).toBe('Marvel Rivals');
        });
    });

    describe('getPatchNotesUrl', () => {
        it('should return the main patch notes URL', () => {
            const url = fetcher.getPatchNotesUrl();
            expect(url).toBe('https://www.marvelrivals.com/gameupdate/');
        });
    });

    describe('getPatchNotesUrls', () => {
        it('should return all patch notes URLs', () => {
            const urls = fetcher.getPatchNotesUrls();
            expect(urls).toEqual([
                'https://www.marvelrivals.com/gameupdate/',
                'https://www.marvelrivals.com/balancepost/'
            ]);
        });
    });

    describe('parsePatchNotes', () => {
        it('should parse valid patch notes HTML', () => {
            const mockHtml = `
                <html>
                    <body>
                        <div class="cont-box">
                            <a class="list-item" href="/gameupdate/version-20250115">
                                <img src="https://example.com/image.jpg" />
                                <div class="text">
                                    <h2>Version 20250115 Update</h2>
                                    <p>New hero balance changes and bug fixes.</p>
                                </div>
                            </a>
                        </div>
                    </body>
                </html>
            `;

            const result = fetcher.parsePatchNotes(mockHtml);

            expect(result).not.toBeNull();
            expect(result?.game).toBe('Marvel Rivals');
            expect(result?.title).toBe('Version 20250115 Update');
            expect(result?.content).toBe('New hero balance changes and bug fixes.');
            expect(result?.version).toBe('20250115');
            expect(result?.url).toBe('https://www.marvelrivals.com/gameupdate/version-20250115');
        });

        it('should handle absolute URLs', () => {
            const mockHtml = `
                <html>
                    <body>
                        <div class="cont-box">
                            <a class="list-item" href="https://www.marvelrivals.com/gameupdate/version-20250115">
                                <img src="https://example.com/image.jpg" />
                                <div class="text">
                                    <h2>Version 20250115 Update</h2>
                                    <p>Content here.</p>
                                </div>
                            </a>
                        </div>
                    </body>
                </html>
            `;

            const result = fetcher.parsePatchNotes(mockHtml);

            expect(result).not.toBeNull();
            expect(result?.url).toBe('https://www.marvelrivals.com/gameupdate/version-20250115');
        });

        it('should return null when no list items found', () => {
            const mockHtml = '<html><body><div class="cont-box"></div></body></html>';
            const result = fetcher.parsePatchNotes(mockHtml);
            expect(result).toBeNull();
        });

        it('should return null when title is missing', () => {
            const mockHtml = `
                <html>
                    <body>
                        <div class="cont-box">
                            <a class="list-item" href="/gameupdate/version-20250115">
                                <div class="text">
                                    <p>Content here.</p>
                                </div>
                            </a>
                        </div>
                    </body>
                </html>
            `;

            const result = fetcher.parsePatchNotes(mockHtml);
            expect(result).toBeNull();
        });

        it('should return null when version cannot be extracted', () => {
            const mockHtml = `
                <html>
                    <body>
                        <div class="cont-box">
                            <a class="list-item" href="/gameupdate/patch">
                                <div class="text">
                                    <h2>Invalid Version Format</h2>
                                    <p>Content here.</p>
                                </div>
                            </a>
                        </div>
                    </body>
                </html>
            `;

            const result = fetcher.parsePatchNotes(mockHtml);
            expect(result).toBeNull();
        });
    });

    describe('getVersion', () => {
        it('should return version from parsed patch note', () => {
            const mockPatchNote = {
                game: 'Marvel Rivals',
                title: 'Version 20250115',
                version: '20250115',
            } as any;

            const version = fetcher.getVersion('', mockPatchNote);
            expect(version).toBe('20250115');
        });

        it('should return undefined when patch note has no version', () => {
            const version = fetcher.getVersion('', undefined);
            expect(version).toBeUndefined();
        });
    });
});
