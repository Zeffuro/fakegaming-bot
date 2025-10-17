/// <reference path="../types/vendor.d.ts" />
import { PatchNoteConfig } from '../models/index.js';

/**
 * Abstract base class for fetching patch notes for a game.
 * Subclasses should implement game-specific parsing and enrichment logic.
 */
export abstract class BasePatchNotesFetcher<RawPatchNote = unknown> {
    /** Accent color for embeds */
    protected accentColor?: number;
    /** Name of the game */
    readonly game: string;

    /**
     * @param game Name of the game
     * @param accentColor Optional accent color for embeds
     */
    protected constructor(game: string, accentColor?: number) {
        this.game = game;
        this.accentColor = accentColor;
    }

    /** Returns the URL to fetch patch notes from. */
    abstract getPatchNotesUrl(): string;

    /**
     * Returns an array of URLs to fetch patch notes from.
     * Subclasses can override for multiple sources.
     */
    getPatchNotesUrls(): string[] {
        return [this.getPatchNotesUrl()];
    }

    /** Fetches raw data from the patch notes URL. */
    async fetchRawData(): Promise<RawPatchNote[]> {
        const urls = this.getPatchNotesUrls();
        const f: ((u: string) => Promise<any>) | undefined = (globalThis as any).fetch;
        if (!f) throw new Error('Global fetch is not available in this runtime');
        return await Promise.all(urls.map(async (url) => {
            const res = await f(url);
            const text = await res.text();
            return text as unknown as RawPatchNote;
        }));
    }

    /** Parses raw data into a PatchNoteConfig object. */
    abstract parsePatchNotes(_raw: RawPatchNote): PatchNoteConfig | null;

    /** Thumbnail URL for the patch note (optional override). */
    getThumbnailUrl(_raw: RawPatchNote, patchNote?: PatchNoteConfig): string | undefined {
        return patchNote?.imageUrl;
    }

    /** Version string for the patch note (optional override). */
    getVersion(_raw: RawPatchNote, patchNote?: PatchNoteConfig): string | undefined {
        return patchNote?.version;
    }

    /**
     * Enriches the patch note with additional fields.
     */
    protected enrichPatchNote(raw: RawPatchNote, patchNote: PatchNoteConfig): PatchNoteConfig {
        return {
            ...patchNote,
            imageUrl: this.getThumbnailUrl(raw, patchNote),
            version: this.getVersion(raw, patchNote),
            accentColor: this.accentColor
        } as PatchNoteConfig;
    }

    /** Compare two version strings for monotonic increase. */
    protected compareVersions(a?: string, b?: string): boolean {
        return !a || !b || a < b;
    }

    /** Optionally fetch full patch content from a URL. */
    protected async fetchFullPatchContent(_url: string): Promise<{ content: string; fullImage?: string } | null> {
        return null;
    }

    /**
     * Fetch the latest patch note, optionally comparing to a stored version.
     */
    async fetchLatestPatchNote(storedVersion?: string): Promise<PatchNoteConfig | null> {
        const raws = await this.fetchRawData();
        let latest: PatchNoteConfig | null = null;
        for (const raw of raws) {
            const patchNote = this.parsePatchNotes(raw);
            if (patchNote && this.compareVersions(storedVersion, patchNote.version)) {
                if (!latest || this.compareVersions(latest.version, patchNote.version)) {
                    latest = patchNote.get();
                }
            }
        }
        if (!latest) return null;
        const full = await this.fetchFullPatchContent(latest.url);
        if (full) {
            latest.content = full.content;
            if (full.fullImage) {
                latest.imageUrl = full.fullImage;
            }
        }
        return this.enrichPatchNote({} as RawPatchNote, latest);
    }
}
