/**
 * Abstract base class for fetching patch notes for a game.
 * Subclasses should implement game-specific parsing and enrichment logic.
 */
import {PatchNoteConfig} from '../../types/patchNoteConfig.js';
import axios from 'axios';

export abstract class BasePatchNotesFetcher {
    /** Accent color for embeds */
    protected accentColor?: number;
    /** Name of the game */
    readonly game: string;

    /**
     * @param game Name of the game
     * @param accentColor Optional accent color for embeds
     */
    constructor(game: string, accentColor?: number) {
        this.game = game;
        this.accentColor = accentColor;
    }

    /**
     * Returns the URL to fetch patch notes from.
     */
    abstract getPatchNotesUrl(): string;

    /**
     * Fetches raw data from the patch notes URL.
     * @returns Raw response data
     */
    async fetchRawData(): Promise<any> {
        const url = this.getPatchNotesUrl();
        const res = await axios.get(url);
        return res.data;
    }

    /**
     * Parses raw data into a PatchNoteConfig object.
     * @param raw Raw response data
     * @returns PatchNoteConfig or null if parsing fails
     */
    abstract parsePatchNotes(raw: any): PatchNoteConfig | null;

    /**
     * Returns the thumbnail URL for the patch note.
     * Subclasses can override to extract from raw or patchNote.
     * @param _raw Raw response data
     * @param patchNote Parsed patch note config
     */
    getThumbnailUrl(_raw: any, patchNote?: PatchNoteConfig): string | undefined {
        return undefined;
    }

    /**
     * Returns the version string for the patch note.
     * Subclasses can override to extract from raw or patchNote.
     * @param _raw Raw response data
     * @param patchNote Parsed patch note config
     */
    getVersion(_raw: any, patchNote?: PatchNoteConfig): string | undefined {
        return undefined;
    }

    /**
     * Enriches the patch note with additional fields.
     * @param raw Raw response data
     * @param patchNote Parsed patch note config
     * @returns Enriched PatchNoteConfig
     */
    protected enrichPatchNote(raw: any, patchNote: PatchNoteConfig): PatchNoteConfig {
        return {
            ...patchNote,
            imageUrl: this.getThumbnailUrl(raw, patchNote),
            version: this.getVersion(raw, patchNote),
            accentColor: this.accentColor
        };
    }

    /**
     * Compares two version strings.
     * @param a First version
     * @param b Second version
     * @returns True if a is less than b or either is undefined
     */
    protected compareVersions(a?: string, b?: string): boolean {
        return !a || !b || a < b;
    }

    /**
     * Optionally fetches full patch content from a URL.
     * Subclasses can override for richer content.
     * @param _url Patch note URL
     * @returns Content and highlight image, or null
     */
    protected async fetchFullPatchContent(_url: string): Promise<{ content: string, highlightImage?: string } | null> {
        return null;
    }

    /**
     * Fetches the latest patch note, optionally comparing to a stored version.
     * @param storedVersion Previously stored version string
     * @returns Latest PatchNoteConfig or null if not newer
     */
    async fetchLatestPatchNote(storedVersion?: string): Promise<PatchNoteConfig | null> {
        const raw = await this.fetchRawData();
        const patchNote = this.parsePatchNotes(raw);
        if (!patchNote) return null;

        if (!this.compareVersions(storedVersion, patchNote.version)) {
            return null;
        }

        const full = await this.fetchFullPatchContent(patchNote.url);
        if (full) {
            patchNote.content = full.content;
            patchNote.imageUrl = full.highlightImage;
        }

        return this.enrichPatchNote(raw, patchNote);
    }
}