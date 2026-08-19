import type { Request, Response } from 'express';
import { z } from 'zod';
import { getConfigManager, validateParams, validateQuery } from '@zeffuro/fakegaming-common';
import {
    permissionNamesFromBitfield,
    rolePermissionChannelKind,
    rolePermissionOverwriteType,
    retryFetchJson,
} from '@zeffuro/fakegaming-common/discord';
import {
    ROLE_PERMISSION_SNAPSHOT_VERSION,
    type RolePermissionSnapshotChannel,
    type RolePermissionSnapshotData,
    type RolePermissionSnapshotMember,
    type RolePermissionSnapshotPermissionOverwrite,
    type RolePermissionSnapshotRole,
} from '@zeffuro/fakegaming-common/models';
import type { RolePermissionSnapshotRecord } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../utils/authHelpers.js';
import { createBaseRouter } from '../utils/createBaseRouter.js';

const router = createBaseRouter();

const guildQuerySchema = z.object({
    guildId: z.string().trim().min(1).max(255),
}).strict();

const snapshotParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
}).strict();

interface DiscordGuildPayload {
    id?: unknown;
    name?: unknown;
    approximate_member_count?: unknown;
}

interface DiscordRolePayload {
    id?: unknown;
    name?: unknown;
    position?: unknown;
    color?: unknown;
    permissions?: unknown;
    managed?: unknown;
    hoist?: unknown;
    mentionable?: unknown;
}

interface DiscordMemberPayload {
    user?: {
        id?: unknown;
        username?: unknown;
        global_name?: unknown;
    };
    nick?: unknown;
    roles?: unknown;
}

interface DiscordChannelPayload {
    id?: unknown;
    name?: unknown;
    type?: unknown;
    position?: unknown;
    parent_id?: unknown;
    permission_overwrites?: unknown;
}

interface DiscordPermissionOverwritePayload {
    id?: unknown;
    type?: unknown;
    allow?: unknown;
    deny?: unknown;
}

interface AuthenticatedRequest extends Request {
    user?: {
        discordId?: string;
    };
}

/**
 * @openapi
 * /rolePermissionSnapshots:
 *   get:
 *     summary: List saved role and channel permission snapshots for a guild
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Saved snapshots in newest-first order
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', jwtAuth, validateQuery(guildQuerySchema), requireGuildAdmin, async (req, res) => {
    const { guildId } = req.query as z.infer<typeof guildQuerySchema>;
    const snapshots = await getConfigManager().rolePermissionSnapshotManager.listSnapshots(guildId, 25);

    res.json({ snapshots: snapshots.map(serializeSnapshotRecord) });
});

/**
 * @openapi
 * /rolePermissionSnapshots/live:
 *   get:
 *     summary: Read the current role and channel permission state from Discord
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Live role, member, channel, and category permission state
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       503:
 *         description: Discord role or channel data could not be read
 */
router.get('/live', jwtAuth, validateQuery(guildQuerySchema), requireGuildAdmin, async (req, res) => {
    const { guildId } = req.query as z.infer<typeof guildQuerySchema>;
    const snapshot = await loadLiveSnapshotOrRespond(guildId, res);
    if (!snapshot) return;

    res.set('Cache-Control', 'private, no-store').json({ snapshot });
});

/**
 * @openapi
 * /rolePermissionSnapshots/live:
 *   post:
 *     summary: Save a current role and channel permission snapshot from Discord
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Saved live snapshot
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       503:
 *         description: Discord role or channel data could not be read
 */
router.post('/live', jwtAuth, validateQuery(guildQuerySchema), requireGuildAdmin, async (req, res) => {
    const { guildId } = req.query as z.infer<typeof guildQuerySchema>;
    const snapshot = await loadLiveSnapshotOrRespond(guildId, res);
    if (!snapshot) return;
    const createdById = (req as AuthenticatedRequest).user?.discordId ?? 'dashboard';
    const saved = await getConfigManager().rolePermissionSnapshotManager.createSnapshot({
        guildId,
        guildName: snapshot.guild.name,
        createdById,
        snapshot,
    });

    res.status(201).json({ snapshot: serializeSnapshotRecord(saved) });
});

/**
 * @openapi
 * /rolePermissionSnapshots/{id}:
 *   get:
 *     summary: Read one saved role and channel permission snapshot
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Saved snapshot
 *       404:
 *         description: Snapshot not found
 */
router.get('/:id', jwtAuth, validateParams(snapshotParamsSchema), validateQuery(guildQuerySchema), requireGuildAdmin, async (req, res) => {
    const { guildId } = req.query as z.infer<typeof guildQuerySchema>;
    const { id } = req.params as unknown as z.infer<typeof snapshotParamsSchema>;
    const snapshot = await getConfigManager().rolePermissionSnapshotManager.getSnapshot(guildId, id);

    if (!snapshot) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Permission snapshot was not found.' } });
    }

    return res.json({ snapshot: serializeSnapshotRecord(snapshot) });
});

async function loadLiveSnapshotOrRespond(guildId: string, res: Response): Promise<RolePermissionSnapshotData | null> {
    try {
        return await loadLiveSnapshot(guildId);
    } catch {
        res.status(503).json({
            error: {
                code: 'DISCORD_PERMISSION_STATE_UNAVAILABLE',
                message: 'Discord role or channel permissions could not be read right now.',
            },
        });
        return null;
    }
}

async function loadLiveSnapshot(guildId: string): Promise<RolePermissionSnapshotData> {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
        throw new Error('DISCORD_BOT_TOKEN is not configured for live permission reads.');
    }

    const headers = { Authorization: `Bot ${botToken}` };
    const [guild, rawRoles, rawChannels] = await Promise.all([
        fetchDiscordJson<DiscordGuildPayload>(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}`, headers),
        fetchDiscordJson<DiscordRolePayload[]>(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/roles`, headers),
        fetchDiscordJson<DiscordChannelPayload[]>(`https://discord.com/api/guilds/${encodeURIComponent(guildId)}/channels`, headers),
    ]);

    const memberResult = await fetchGuildMembers(guildId, headers);
    const roles = snapshotRoles(rawRoles, memberResult.members, guildId);
    const channels = snapshotChannels(rawChannels);

    return {
        version: ROLE_PERMISSION_SNAPSHOT_VERSION,
        capturedAt: new Date().toISOString(),
        guild: {
            id: guildId,
            name: readString(guild.name, `Guild ${guildId}`),
            memberCount: memberResult.members.length || readNonNegativeInteger(guild.approximate_member_count),
        },
        roleData: {
            source: 'fetched',
            capturedRoleCount: roles.length,
            fetchFailed: false,
        },
        memberData: {
            source: memberResult.fetchFailed ? 'unavailable' : 'fetched',
            capturedMemberCount: memberResult.members.length,
            fetchFailed: memberResult.fetchFailed,
        },
        channelData: {
            source: 'fetched',
            capturedChannelCount: channels.length,
            fetchFailed: false,
        },
        roles,
        channels,
    };
}

async function fetchDiscordJson<T>(url: string, headers: Record<string, string>): Promise<T> {
    return retryFetchJson<T>({
        url,
        init: { headers },
        rateLimitExhaustedMessage: 'Discord rate limit exhausted while reading permission state.',
    });
}

async function fetchGuildMembers(guildId: string, headers: Record<string, string>): Promise<{
    members: DiscordMemberPayload[];
    fetchFailed: boolean;
}> {
    const members: DiscordMemberPayload[] = [];
    let after: string | undefined;

    try {
        do {
            const query = new URLSearchParams({ limit: '1000' });
            if (after) query.set('after', after);
            const page = await fetchDiscordJson<DiscordMemberPayload[]>(
                `https://discord.com/api/guilds/${encodeURIComponent(guildId)}/members?${query.toString()}`,
                headers,
            );
            if (!Array.isArray(page) || page.length === 0) break;

            members.push(...page);
            const lastMember = page.at(-1);
            const lastId = typeof lastMember?.user?.id === 'string' ? lastMember.user.id : undefined;
            if (!lastId || page.length < 1000) break;
            after = lastId;
        } while (after);

        return { members, fetchFailed: false };
    } catch {
        return { members: [], fetchFailed: true };
    }
}

function snapshotRoles(
    rawRoles: DiscordRolePayload[],
    rawMembers: DiscordMemberPayload[],
    guildId: string,
): RolePermissionSnapshotRole[] {
    const membersByRole = new Map<string, RolePermissionSnapshotMember[]>();
    for (const role of rawRoles) {
        if (typeof role.id === 'string') membersByRole.set(role.id, []);
    }

    for (const rawMember of rawMembers) {
        const member = snapshotMember(rawMember);
        if (!member) continue;

        const roleIds = new Set(readStringArray(rawMember.roles));
        if (membersByRole.has(guildId)) roleIds.add(guildId);
        for (const roleId of roleIds) {
            membersByRole.get(roleId)?.push(member);
        }
    }

    return rawRoles
        .filter((role): role is DiscordRolePayload & { id: string } => typeof role.id === 'string')
        .map(role => {
            const color = readNonNegativeInteger(role.color);
            const permissionsBitfield = readString(role.permissions, '0');
            return {
                id: role.id,
                name: readString(role.name, role.id),
                position: readInteger(role.position),
                color,
                hexColor: `#${color.toString(16).padStart(6, '0')}`,
                managed: role.managed === true,
                hoist: role.hoist === true,
                mentionable: role.mentionable === true,
                permissions: permissionNamesFromBitfield(permissionsBitfield),
                permissionsBitfield,
                members: (membersByRole.get(role.id) ?? []).sort((left, right) => left.id.localeCompare(right.id)),
            };
        })
        .sort((left, right) => right.position - left.position || left.id.localeCompare(right.id));
}

function snapshotMember(value: DiscordMemberPayload): RolePermissionSnapshotMember | null {
    const id = typeof value.user?.id === 'string' ? value.user.id : null;
    if (!id) return null;

    const username = readString(value.user?.username, id);
    const globalName = typeof value.user?.global_name === 'string' ? value.user.global_name : null;
    const nickname = typeof value.nick === 'string' ? value.nick : null;
    return {
        id,
        username,
        globalName,
        displayName: nickname ?? globalName ?? username,
        nickname,
    };
}

function snapshotChannels(rawChannels: DiscordChannelPayload[]): RolePermissionSnapshotChannel[] {
    return rawChannels
        .filter(channel => !isThreadChannel(readInteger(channel.type)))
        .filter((channel): channel is DiscordChannelPayload & { id: string } => typeof channel.id === 'string')
        .map(channel => ({
            id: channel.id,
            name: readString(channel.name, channel.id),
            kind: rolePermissionChannelKind(readInteger(channel.type)),
            channelType: readInteger(channel.type),
            position: readInteger(channel.position),
            parentId: typeof channel.parent_id === 'string' ? channel.parent_id : null,
            permissionOverwrites: snapshotPermissionOverwrites(channel.permission_overwrites),
        }))
        .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

function snapshotPermissionOverwrites(value: unknown): RolePermissionSnapshotPermissionOverwrite[] {
    if (!Array.isArray(value)) return [];

    return value
        .filter((overwrite): overwrite is DiscordPermissionOverwritePayload => Boolean(overwrite && typeof overwrite === 'object'))
        .filter((overwrite): overwrite is DiscordPermissionOverwritePayload & { id: string } => typeof overwrite.id === 'string')
        .map(overwrite => {
            const allow = readString(overwrite.allow, '0');
            const deny = readString(overwrite.deny, '0');
            return {
                id: overwrite.id,
                type: rolePermissionOverwriteType(readInteger(overwrite.type)),
                allow,
                deny,
                allowPermissions: permissionNamesFromBitfield(allow),
                denyPermissions: permissionNamesFromBitfield(deny),
            };
        })
        .sort((left, right) => left.type.localeCompare(right.type) || left.id.localeCompare(right.id));
}

function isThreadChannel(channelType: number): boolean {
    return channelType === 10 || channelType === 11 || channelType === 12;
}

function serializeSnapshotRecord(record: RolePermissionSnapshotRecord) {
    return {
        id: record.id,
        guildId: record.guildId,
        guildName: record.guildName,
        createdById: record.createdById,
        snapshot: record.snapshot,
        createdAt: record.createdAt.toISOString(),
    };
}

function readString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function readStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function readInteger(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function readNonNegativeInteger(value: unknown): number {
    return Math.max(0, readInteger(value));
}

export { router };
