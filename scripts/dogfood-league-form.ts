import { bootstrapEnv, getSequelize } from '@zeffuro/fakegaming-common';
import { AuditEvent } from '@zeffuro/fakegaming-common/models';

interface CliOptions {
    channelId: string;
    checkCache: boolean;
    guildId: string;
    help: boolean;
    refresh: boolean;
    region?: string;
    riotId?: string;
    syncDb: boolean;
    userId: string;
}

interface DogfoodCommand {
    execute: (interaction: unknown) => Promise<void>;
}

interface DogfoodReplySummary {
    embedCount?: number;
    kind: 'embed' | 'text' | 'unknown';
    text?: string;
}

interface AuditSummary {
    cacheStatus: string | null;
    errorCategory: string | null;
    failedDetailCount: number | null;
    matchCount: number | null;
    outcome: string | null;
    refreshRequested: boolean | null;
    severity: string;
    source: string | null;
    status: string;
    summaryStatus: string | null;
}

interface DogfoodRunSummary {
    audit: AuditSummary | null;
    label: string;
    reply: DogfoodReplySummary;
}

const DEFAULT_USER_ID = 'dogfood-user';
const DEFAULT_GUILD_ID = 'dogfood-guild';
const DEFAULT_CHANNEL_ID = 'dogfood-channel';

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    bootstrapEnv(new URL('../packages/bot/src/earlyEnv.ts', import.meta.url).href);
    await assertDatabaseReachable(options);

    const { default: command } = await import('../packages/bot/src/modules/league/commands/leagueForm.js') as { default: DogfoodCommand };

    const runs: DogfoodRunSummary[] = [];
    runs.push(await executeDogfoodRun(command, options, 'initial'));

    if (options.checkCache) {
        runs.push(await executeDogfoodRun(command, {
            ...options,
            refresh: false,
        }, 'cache-check'));
    }

    console.log(JSON.stringify(options.checkCache ? { runs } : runs[0], null, 2));
}

function parseArgs(args: string[]): CliOptions {
    const options: CliOptions = {
        channelId: DEFAULT_CHANNEL_ID,
        checkCache: false,
        guildId: DEFAULT_GUILD_ID,
        help: false,
        refresh: false,
        syncDb: false,
        userId: DEFAULT_USER_ID,
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--') continue;
        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }
        if (arg === '--refresh') {
            options.refresh = true;
            continue;
        }
        if (arg === '--sync-db') {
            options.syncDb = true;
            continue;
        }
        if (arg === '--check-cache') {
            options.checkCache = true;
            continue;
        }

        const next = args[index + 1];
        if (!next || next.startsWith('--')) {
            throw new Error(`Missing value for ${arg}`);
        }

        if (arg === '--riot-id') {
            options.riotId = next;
        } else if (arg === '--region') {
            options.region = next;
        } else if (arg === '--user-id') {
            options.userId = next;
        } else if (arg === '--guild-id') {
            options.guildId = next;
        } else if (arg === '--channel-id') {
            options.channelId = next;
        } else {
            throw new Error(`Unknown option: ${arg}`);
        }
        index += 1;
    }

    return options;
}

function printHelp(): void {
    console.log([
        'Dogfood /league-form without connecting to Discord.',
        '',
        'Usage:',
        '  pnpm run dogfood:league-form -- --riot-id "Name#TAG" --region EUW1 [--refresh] [--check-cache] [--sync-db]',
        '  pnpm run dogfood:league-form -- --user-id discord-user-id [--refresh] [--check-cache] [--sync-db]',
        '',
        'Notes:',
        '- Uses packages/bot/.env and the configured app database.',
        '- Does not sync schema unless --sync-db is passed.',
        '- --check-cache runs the same command a second time in-process with refresh off.',
        '- Prints only sanitized reply shape and aggregate riot.leagueForm audit metadata.',
    ].join('\n'));
}

async function executeDogfoodRun(command: DogfoodCommand, options: CliOptions, label: string): Promise<DogfoodRunSummary> {
    const startedAt = new Date();
    const replies: DogfoodReplySummary[] = [];
    const interaction = createDogfoodInteraction(options, replies);

    await command.execute(interaction);

    return {
        audit: await findLatestLeagueFormAudit(options, startedAt),
        label,
        reply: replies.at(-1) ?? { kind: 'unknown' },
    };
}

async function assertDatabaseReachable(options: CliOptions): Promise<void> {
    try {
        await prepareDatabase(options);
    } catch (error: unknown) {
        const details = getDatabaseErrorDetails(error);
        throw new Error(`Configured app database is not reachable (${details}).`);
    }
}

async function prepareDatabase(options: CliOptions): Promise<void> {
    const sequelize = getSequelize(false);
    await sequelize.authenticate();
    if (options.syncDb) {
        await sequelize.sync();
    }
}

function createDogfoodInteraction(options: CliOptions, replies: DogfoodReplySummary[]): unknown {
    return {
        channelId: options.channelId,
        commandName: 'league-form',
        deferReply: async () => undefined,
        editReply: async (payload: unknown) => {
            replies.push(summarizeReply(payload));
            return undefined;
        },
        guildId: options.guildId,
        options: {
            getBoolean: (name: string) => name === 'refresh' ? options.refresh : null,
            getString: (name: string) => {
                if (name === 'riot-id' || name === 'summoner') return options.riotId ?? null;
                if (name === 'region') return options.region ?? null;
                return null;
            },
            getUser: () => null,
        },
        user: {
            id: options.userId,
        },
    };
}

function summarizeReply(payload: unknown): DogfoodReplySummary {
    if (typeof payload === 'string') {
        return {
            kind: 'text',
            text: sanitizeReplyText(payload),
        };
    }

    if (payload && typeof payload === 'object' && 'embeds' in payload) {
        const embeds = (payload as { embeds?: unknown }).embeds;
        const embedCount = Array.isArray(embeds) ? embeds.length : 0;
        return {
            embedCount,
            kind: 'embed',
        };
    }

    return { kind: 'unknown' };
}

function sanitizeReplyText(value: string): string {
    return value
        .replace(/[A-Za-z0-9_-]{20,}/g, '[redacted-id]')
        .slice(0, 240);
}

async function findLatestLeagueFormAudit(options: CliOptions, startedAt: Date): Promise<AuditSummary | null> {
    const row = await AuditEvent.findOne({
        order: [['timestamp', 'DESC'], ['id', 'DESC']],
        raw: true,
        where: {
            action: 'riot.leagueForm',
            actorId: options.userId,
            guildId: options.guildId,
        },
    });

    if (!row) return null;

    const record = row as {
        metadata?: unknown;
        severity?: unknown;
        status?: unknown;
        timestamp?: unknown;
    };
    if (normalizeTimestamp(record.timestamp) < startedAt.getTime()) return null;

    const metadata = normalizeMetadata(record.metadata);

    return {
        cacheStatus: readString(metadata, 'cacheStatus'),
        errorCategory: readString(metadata, 'errorCategory'),
        failedDetailCount: readNumber(metadata, 'failedDetailCount'),
        matchCount: readNumber(metadata, 'matchCount'),
        outcome: readString(metadata, 'outcome'),
        refreshRequested: readBoolean(metadata, 'refreshRequested'),
        severity: typeof record.severity === 'string' ? record.severity : 'info',
        source: readString(metadata, 'source'),
        status: typeof record.status === 'string' ? record.status : 'success',
        summaryStatus: readString(metadata, 'summaryStatus'),
    };
}

function normalizeTimestamp(value: unknown): number {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
    if (!value) return null;
    if (typeof value === 'string') {
        try {
            return normalizeMetadata(JSON.parse(value));
        } catch {
            return null;
        }
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return null;
}

function readString(metadata: Record<string, unknown> | null, key: string): string | null {
    const value = metadata?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readNumber(metadata: Record<string, unknown> | null, key: string): number | null {
    const value = metadata?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(metadata: Record<string, unknown> | null, key: string): boolean | null {
    const value = metadata?.[key];
    return typeof value === 'boolean' ? value : null;
}

function getDatabaseErrorDetails(error: unknown): string {
    const record = error && typeof error === 'object' ? error as { name?: unknown; parent?: unknown } : {};
    const parent = record.parent && typeof record.parent === 'object' ? record.parent as { code?: unknown } : {};
    const name = typeof record.name === 'string' && record.name.length > 0 ? record.name : 'database error';
    const code = typeof parent.code === 'string' && parent.code.length > 0 ? `/${parent.code}` : '';
    return `${name}${code}`;
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`League form dogfood failed: ${message}`);
    process.exit(1);
});
