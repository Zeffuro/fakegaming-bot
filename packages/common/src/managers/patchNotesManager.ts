import {BaseManager} from './baseManager.js';
import {PatchNoteConfig} from '../models/patch-note-config.js';
import {PatchNoteHistoryConfig} from '../models/patch-note-history-config.js';
import {PatchSubscriptionConfig} from '../models/patch-subscription-config.js';
import { col, fn, Op, type Attributes, type CreationAttributes, type WhereOptions } from 'sequelize';
import { createHash } from 'node:crypto';

const DEFAULT_PATCH_NOTE_HISTORY_RETENTION_DAYS = 365;
const DEFAULT_PATCH_NOTE_HISTORY_MAX_PER_GAME = 50;
const DEFAULT_PATCH_NOTE_HISTORY_MAX_BODY_BYTES = 120_000;
const DEFAULT_PATCH_NOTE_COMPARE_MAX_INPUT_LINES = 500;
const DEFAULT_PATCH_NOTE_COMPARE_MAX_DIFF_LINES = 350;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PatchNoteHistoryRetentionOptions {
    maxContentBytes?: number;
    maxRowsPerGame?: number;
    now?: Date;
    retentionDays?: number;
}

export interface ResolvedPatchNoteHistoryRetentionOptions {
    maxContentBytes: number;
    maxRowsPerGame: number;
    now: Date;
    retentionDays: number;
}

export interface PatchNoteHistoryRecordResult {
    contentBytes: number;
    contentTruncated: boolean;
    inserted: boolean;
    prunedRows: number;
}

export interface PatchNoteHistoryGameStorageSummary {
    contentBytes: number;
    game: string;
    newestPublishedAt: number | null;
    oldestPublishedAt: number | null;
    rows: number;
    warnings: string[];
}

export interface PatchNoteHistoryStorageSummary {
    games: PatchNoteHistoryGameStorageSummary[];
    generatedAt: string;
    retention: {
        cutoffPublishedAt: number;
        maxBodyBytes: number;
        maxRowsPerGame: number;
        retentionDays: number;
    };
    totalContentBytes: number;
    totalRows: number;
    warnings: string[];
}

export interface PatchNoteHistoryListOptions {
    fromPublishedAt?: number;
    game?: string;
    limit?: number;
    offset?: number;
    query?: string;
    toPublishedAt?: number;
}

export interface PatchNoteHistoryListResult {
    items: CreationAttributes<PatchNoteHistoryConfig>[];
    limit: number;
    offset: number;
    total: number;
}

export interface PatchNoteHistoryCompareOptions {
    maxDiffLines?: number;
    maxInputLines?: number;
}

export interface PatchNoteHistoryCompareRecord {
    contentBytes: number;
    game: string;
    id: number;
    publishedAt: number;
    title: string;
    url: string;
    version: string | null;
}

export type PatchNoteHistoryDiffLineKind = 'added' | 'removed' | 'unchanged';

export interface PatchNoteHistoryDiffLine {
    kind: PatchNoteHistoryDiffLineKind;
    leftLine?: number;
    rightLine?: number;
    text: string;
}

export interface PatchNoteHistoryCompareResult {
    diff: PatchNoteHistoryDiffLine[];
    left: PatchNoteHistoryCompareRecord;
    right: PatchNoteHistoryCompareRecord;
    summary: {
        addedLines: number;
        emittedLines: number;
        inputTruncated: boolean;
        maxDiffLines: number;
        maxInputLines: number;
        removedLines: number;
        totalDiffLines: number;
        truncated: boolean;
        unchangedLines: number;
    };
}

interface PatchNoteHistoryStorageRawRow {
    contentBytes?: number | string | null;
    game?: string | null;
    newestPublishedAt?: number | string | null;
    oldestPublishedAt?: number | string | null;
    rows?: number | string | null;
}

export class PatchNotesManager extends BaseManager<PatchNoteConfig> {
    constructor() {
        super(PatchNoteConfig);
    }

    async getLatestPatch(game: string): Promise<PatchNoteConfig | null> {
        return this.getOne({ game });
    }

    async setLatestPatch(patch: Partial<PatchNoteConfig> | PatchNoteConfig): Promise<PatchNoteHistoryRecordResult | null> {
        const data = patch instanceof PatchNoteConfig ? patch.get({ plain: true }) : patch;
        await this.upsert(data, ['game']);
        if (data.game && data.url) {
            return await new PatchNoteHistoryManager().recordPatch(data as Partial<PatchNoteHistoryConfig> & { game: string; url: string });
        }
        return null;
    }
}

export class PatchNoteHistoryManager extends BaseManager<PatchNoteHistoryConfig> {
    constructor() {
        super(PatchNoteHistoryConfig);
    }

    async recordPatch(
        patch: Partial<PatchNoteHistoryConfig> & { game: string; url: string },
        options: PatchNoteHistoryRetentionOptions = {}
    ): Promise<PatchNoteHistoryRecordResult> {
        const retention = resolvePatchNoteHistoryRetentionOptions(options);
        const boundedContent = truncateUtf8Bytes(patch.content ?? '', retention.maxContentBytes);
        const boundedPatch = {
            ...patch,
            content: boundedContent.value,
            contentHash: patch.contentHash ?? hashPatchNoteContent(patch.content ?? ''),
        };
        const inserted = await this.upsertHistoryRecord(boundedPatch);
        const prunedRows = await this.pruneForGame(patch.game, retention);

        return {
            contentBytes: boundedContent.bytes,
            contentTruncated: boundedContent.truncated,
            inserted,
            prunedRows,
        };
    }

    async getHistory(game: string, limit = 5): Promise<CreationAttributes<PatchNoteHistoryConfig>[]> {
        const { rows } = await this.getAndCountAll({
            where: { game },
            order: [['publishedAt', 'DESC']],
            limit,
            raw: true,
        });
        return rows;
    }

    async listHistory(options: PatchNoteHistoryListOptions = {}): Promise<PatchNoteHistoryListResult> {
        const limit = clampInteger(options.limit, 30, 1, 50);
        const offset = clampInteger(options.offset, 0, 0, 10_000);
        const where = buildHistoryWhere(options);
        const { rows, count } = await this.getAndCountAll({
            where,
            order: [['publishedAt', 'DESC'], ['id', 'DESC']],
            limit,
            offset,
            raw: true,
        });

        return {
            items: rows,
            limit,
            offset,
            total: count,
        };
    }

    async getHistoryRecord(id: number): Promise<CreationAttributes<PatchNoteHistoryConfig>> {
        return this.findByPk(id, { raw: true });
    }

    async compareHistoryRecordIds(
        leftId: number,
        rightId: number,
        options: PatchNoteHistoryCompareOptions = {}
    ): Promise<PatchNoteHistoryCompareResult> {
        const [left, right] = await Promise.all([
            this.getHistoryRecord(leftId),
            this.getHistoryRecord(rightId),
        ]);

        return this.compareHistoryRecords(left, right, options);
    }

    compareHistoryRecords(
        left: CreationAttributes<PatchNoteHistoryConfig>,
        right: CreationAttributes<PatchNoteHistoryConfig>,
        options: PatchNoteHistoryCompareOptions = {}
    ): PatchNoteHistoryCompareResult {
        return comparePatchNoteHistoryRecords(left, right, options);
    }

    async pruneForGame(game: string, options: PatchNoteHistoryRetentionOptions = {}): Promise<number> {
        const retention = resolvePatchNoteHistoryRetentionOptions(options);
        const cutoff = retention.now.getTime() - (retention.retentionDays * DAY_MS);
        let prunedRows = await this.model.destroy({
            where: {
                game,
                publishedAt: { [Op.lt]: cutoff },
            },
        });

        const rows = await this.model.findAll({
            attributes: ['id'],
            where: { game },
            order: [['publishedAt', 'DESC'], ['id', 'DESC']],
            raw: true,
        }) as Array<{ id: number }>;
        const staleIds = rows.slice(retention.maxRowsPerGame).map(row => row.id);
        if (staleIds.length > 0) {
            prunedRows += await this.model.destroy({
                where: {
                    id: { [Op.in]: staleIds },
                },
            });
        }

        return prunedRows;
    }

    async getStorageSummary(options: PatchNoteHistoryRetentionOptions = {}): Promise<PatchNoteHistoryStorageSummary> {
        const retention = resolvePatchNoteHistoryRetentionOptions(options);
        const cutoffPublishedAt = retention.now.getTime() - (retention.retentionDays * DAY_MS);
        const rows = await this.model.findAll({
            attributes: [
                'game',
                [fn('COUNT', col('id')), 'rows'],
                [fn('MIN', col('publishedAt')), 'oldestPublishedAt'],
                [fn('MAX', col('publishedAt')), 'newestPublishedAt'],
                [fn('SUM', fn('LENGTH', col('content'))), 'contentBytes'],
            ],
            group: ['game'],
            raw: true,
        }) as unknown as PatchNoteHistoryStorageRawRow[];

        const games = rows
            .map(row => {
                const game = row.game ?? 'unknown';
                const contentBytes = toNumber(row.contentBytes);
                const itemRows = toNumber(row.rows);
                const oldestPublishedAt = toNullableNumber(row.oldestPublishedAt);
                const newestPublishedAt = toNullableNumber(row.newestPublishedAt);
                const warnings = buildStorageWarnings({
                    contentBytes,
                    cutoffPublishedAt,
                    maxBodyBytes: retention.maxContentBytes,
                    maxRowsPerGame: retention.maxRowsPerGame,
                    oldestPublishedAt,
                    rows: itemRows,
                });

                return {
                    contentBytes,
                    game,
                    newestPublishedAt,
                    oldestPublishedAt,
                    rows: itemRows,
                    warnings,
                };
            })
            .sort((left, right) => right.rows - left.rows || left.game.localeCompare(right.game));

        return {
            games,
            generatedAt: retention.now.toISOString(),
            retention: {
                cutoffPublishedAt,
                maxBodyBytes: retention.maxContentBytes,
                maxRowsPerGame: retention.maxRowsPerGame,
                retentionDays: retention.retentionDays,
            },
            totalContentBytes: games.reduce((sum, game) => sum + game.contentBytes, 0),
            totalRows: games.reduce((sum, game) => sum + game.rows, 0),
            warnings: [...new Set(games.flatMap(game => game.warnings))].sort((left, right) => left.localeCompare(right)),
        };
    }

    private async upsertHistoryRecord(patch: Partial<PatchNoteHistoryConfig> & { game: string; url: string }): Promise<boolean> {
        const existingByUrl = await this.model.findOne({ where: { game: patch.game, url: patch.url } });
        if (existingByUrl) {
            await existingByUrl.update(patch);
            return false;
        }

        const existingByHash = patch.contentHash
            ? await this.model.findOne({ where: { game: patch.game, contentHash: patch.contentHash } })
            : null;
        if (existingByHash) {
            await existingByHash.update(patch);
            return false;
        }

        return this.upsert(patch, ['game', 'url']);
    }
}

export function resolvePatchNoteHistoryRetentionOptions(
    options: PatchNoteHistoryRetentionOptions = {},
    env: NodeJS.ProcessEnv = process.env
): ResolvedPatchNoteHistoryRetentionOptions {
    return {
        maxContentBytes: readPositiveInteger(options.maxContentBytes, env.PATCH_NOTE_HISTORY_MAX_BODY_BYTES, DEFAULT_PATCH_NOTE_HISTORY_MAX_BODY_BYTES),
        maxRowsPerGame: readPositiveInteger(options.maxRowsPerGame, env.PATCH_NOTE_HISTORY_MAX_PER_GAME, DEFAULT_PATCH_NOTE_HISTORY_MAX_PER_GAME),
        now: options.now ?? new Date(),
        retentionDays: readPositiveInteger(options.retentionDays, env.PATCH_NOTE_HISTORY_RETENTION_DAYS, DEFAULT_PATCH_NOTE_HISTORY_RETENTION_DAYS),
    };
}

function readPositiveInteger(optionValue: number | undefined, envValue: string | undefined, fallback: number): number {
    if (typeof optionValue === 'number' && Number.isInteger(optionValue) && optionValue > 0) {
        return optionValue;
    }

    const parsed = Number.parseInt(envValue ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function truncateUtf8Bytes(value: string, maxBytes: number): { bytes: number; truncated: boolean; value: string } {
    const initialBytes = Buffer.byteLength(value, 'utf8');
    if (initialBytes <= maxBytes) {
        return { bytes: initialBytes, truncated: false, value };
    }

    let low = 0;
    let high = value.length;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        const candidate = value.slice(0, mid);
        if (Buffer.byteLength(candidate, 'utf8') <= maxBytes) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }

    const truncatedValue = value.slice(0, low);
    return {
        bytes: Buffer.byteLength(truncatedValue, 'utf8'),
        truncated: true,
        value: truncatedValue,
    };
}

export function hashPatchNoteContent(content: string): string {
    return createHash('sha256')
        .update(content)
        .digest('hex');
}

export function comparePatchNoteHistoryRecords(
    left: CreationAttributes<PatchNoteHistoryConfig>,
    right: CreationAttributes<PatchNoteHistoryConfig>,
    options: PatchNoteHistoryCompareOptions = {}
): PatchNoteHistoryCompareResult {
    const maxInputLines = clampInteger(options.maxInputLines, DEFAULT_PATCH_NOTE_COMPARE_MAX_INPUT_LINES, 1, 1_000);
    const maxDiffLines = clampInteger(options.maxDiffLines, DEFAULT_PATCH_NOTE_COMPARE_MAX_DIFF_LINES, 1, 1_000);
    const leftLines = splitPatchContentLines(left.content ?? '');
    const rightLines = splitPatchContentLines(right.content ?? '');
    const inputTruncated = leftLines.length > maxInputLines || rightLines.length > maxInputLines;
    const diff = diffPatchLines(
        leftLines.slice(0, maxInputLines),
        rightLines.slice(0, maxInputLines)
    );
    const summary = summarizePatchDiff(diff);
    const emittedDiff = diff.slice(0, maxDiffLines);

    return {
        diff: emittedDiff,
        left: serializeCompareRecord(left),
        right: serializeCompareRecord(right),
        summary: {
            ...summary,
            emittedLines: emittedDiff.length,
            inputTruncated,
            maxDiffLines,
            maxInputLines,
            totalDiffLines: diff.length,
            truncated: inputTruncated || diff.length > maxDiffLines,
        },
    };
}

function serializeCompareRecord(record: CreationAttributes<PatchNoteHistoryConfig>): PatchNoteHistoryCompareRecord {
    return {
        contentBytes: Buffer.byteLength(record.content ?? '', 'utf8'),
        game: record.game,
        id: record.id,
        publishedAt: record.publishedAt,
        title: record.title,
        url: record.url,
        version: record.version ?? null,
    };
}

function splitPatchContentLines(content: string): string[] {
    const normalizedLines = content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(line => line.length > 0);

    if (normalizedLines.length > 1) {
        return normalizedLines;
    }

    const compact = content.replace(/\s+/g, ' ').trim();
    if (!compact) return [];
    if (compact.length <= 240) return [compact];

    const sentenceLines = compact
        .match(/[^.!?]+[.!?]?/g)
        ?.map(line => line.trim())
        .filter(line => line.length > 0) ?? [];

    return sentenceLines.length > 1 ? sentenceLines : [compact];
}

function diffPatchLines(leftLines: string[], rightLines: string[]): PatchNoteHistoryDiffLine[] {
    const table = Array.from(
        { length: leftLines.length + 1 },
        () => new Array<number>(rightLines.length + 1).fill(0)
    );

    for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
        for (let rightIndex = rightLines.length - 1; rightIndex >= 0; rightIndex -= 1) {
            table[leftIndex][rightIndex] = leftLines[leftIndex] === rightLines[rightIndex]
                ? table[leftIndex + 1][rightIndex + 1] + 1
                : Math.max(table[leftIndex + 1][rightIndex], table[leftIndex][rightIndex + 1]);
        }
    }

    const diff: PatchNoteHistoryDiffLine[] = [];
    let leftIndex = 0;
    let rightIndex = 0;
    let leftLine = 1;
    let rightLine = 1;

    while (leftIndex < leftLines.length && rightIndex < rightLines.length) {
        if (leftLines[leftIndex] === rightLines[rightIndex]) {
            diff.push({
                kind: 'unchanged',
                leftLine,
                rightLine,
                text: leftLines[leftIndex],
            });
            leftIndex += 1;
            rightIndex += 1;
            leftLine += 1;
            rightLine += 1;
            continue;
        }

        if (table[leftIndex + 1][rightIndex] >= table[leftIndex][rightIndex + 1]) {
            diff.push({
                kind: 'removed',
                leftLine,
                text: leftLines[leftIndex],
            });
            leftIndex += 1;
            leftLine += 1;
            continue;
        }

        diff.push({
            kind: 'added',
            rightLine,
            text: rightLines[rightIndex],
        });
        rightIndex += 1;
        rightLine += 1;
    }

    while (leftIndex < leftLines.length) {
        diff.push({
            kind: 'removed',
            leftLine,
            text: leftLines[leftIndex],
        });
        leftIndex += 1;
        leftLine += 1;
    }

    while (rightIndex < rightLines.length) {
        diff.push({
            kind: 'added',
            rightLine,
            text: rightLines[rightIndex],
        });
        rightIndex += 1;
        rightLine += 1;
    }

    return diff;
}

function summarizePatchDiff(diff: PatchNoteHistoryDiffLine[]) {
    return {
        addedLines: diff.filter(line => line.kind === 'added').length,
        removedLines: diff.filter(line => line.kind === 'removed').length,
        unchangedLines: diff.filter(line => line.kind === 'unchanged').length,
    };
}

function buildStorageWarnings(input: {
    contentBytes: number;
    cutoffPublishedAt: number;
    maxBodyBytes: number;
    maxRowsPerGame: number;
    oldestPublishedAt: number | null;
    rows: number;
}): string[] {
    const warnings: string[] = [];
    if (input.rows > input.maxRowsPerGame) {
        warnings.push('rows_exceed_max');
    }
    if (input.oldestPublishedAt !== null && input.oldestPublishedAt < input.cutoffPublishedAt) {
        warnings.push('records_exceed_retention');
    }
    if (input.rows > 0 && input.contentBytes > input.rows * input.maxBodyBytes) {
        warnings.push('content_bytes_exceed_cap');
    }
    return warnings;
}

function toNumber(value: number | string | null | undefined): number {
    const parsed = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function buildHistoryWhere(options: PatchNoteHistoryListOptions): WhereOptions<Attributes<PatchNoteHistoryConfig>> {
    const where: Record<string | symbol, unknown> = {};
    if (options.game) {
        where.game = options.game;
    }

    const publishedAt: { [Op.gte]?: number; [Op.lte]?: number } = {};
    let hasPublishedAtFilter = false;
    if (typeof options.fromPublishedAt === 'number') {
        publishedAt[Op.gte] = options.fromPublishedAt;
        hasPublishedAtFilter = true;
    }
    if (typeof options.toPublishedAt === 'number') {
        publishedAt[Op.lte] = options.toPublishedAt;
        hasPublishedAtFilter = true;
    }
    if (hasPublishedAtFilter) {
        where.publishedAt = publishedAt;
    }

    const query = options.query?.trim();
    if (query) {
        const like = `%${query}%`;
        where[Op.or] = [
            { title: { [Op.like]: like } },
            { version: { [Op.like]: like } },
            { url: { [Op.like]: like } },
        ];
    }

    return where as WhereOptions<Attributes<PatchNoteHistoryConfig>>;
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isInteger(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}


export class PatchSubscriptionManager extends BaseManager<PatchSubscriptionConfig> {
    constructor() {
        super(PatchSubscriptionConfig);
    }

    async subscribe(game: string, channelId: string, guildId: string) {
        await this.findOrCreate({ where: { game, channelId, guildId } });
    }

    async getSubscriptionsForGame(game: string): Promise<CreationAttributes<PatchSubscriptionConfig>[]> {
        return this.getMany({ game }, { raw: true });
    }

    async setPaused(id: number, paused: boolean): Promise<void> {
        await this.update({ paused } as Partial<PatchSubscriptionConfig> as never, { id } as never);
    }

    async upsertSubscription(sub: Partial<PatchSubscriptionConfig> | PatchSubscriptionConfig) {
        const data = sub instanceof PatchSubscriptionConfig ? sub.get({ plain: true }) : sub;
        await this.upsert(data, ['game', 'channelId']);
    }

    // Normalize lastAnnouncedAt before persisting to ensure consistent BIGINT storage
    async upsert(item: CreationAttributes<PatchSubscriptionConfig> | PatchSubscriptionConfig, conflictFields?: string[]): Promise<boolean> {
        const raw = item instanceof PatchSubscriptionConfig ? item.get({ plain: true }) : { ...item } as CreationAttributes<PatchSubscriptionConfig> & { [k: string]: unknown };
        const la = (raw as { lastAnnouncedAt?: unknown }).lastAnnouncedAt;
        if (la instanceof Date) {
            (raw as { lastAnnouncedAt?: number }).lastAnnouncedAt = la.getTime();
        }
        return super.upsert(raw as CreationAttributes<PatchSubscriptionConfig>, conflictFields);
    }
}
