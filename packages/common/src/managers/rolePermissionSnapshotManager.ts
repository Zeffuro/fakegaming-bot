import { Attributes, CreationAttributes, Op, WhereOptions } from 'sequelize';
import { BaseManager } from './baseManager.js';
import {
    RolePermissionSnapshot,
    type RolePermissionSnapshotData,
} from '../models/role-permission-snapshot.js';
import {
    normalizeRolePermissionSnapshot,
    parseRolePermissionSnapshot,
} from '../discord/permissionSnapshot.js';

export const DEFAULT_ROLE_PERMISSION_SNAPSHOT_RETENTION = 25;

export interface CreateRolePermissionSnapshotInput {
    guildId: string;
    guildName: string;
    createdById: string;
    snapshot: RolePermissionSnapshotData;
}

export interface RolePermissionSnapshotRecord {
    id: number;
    guildId: string;
    guildName: string;
    createdById: string;
    snapshot: RolePermissionSnapshotData;
    createdAt: Date;
}

export class RolePermissionSnapshotManager extends BaseManager<RolePermissionSnapshot> {
    constructor() {
        super(RolePermissionSnapshot);
    }

    async createSnapshot(input: CreateRolePermissionSnapshotInput): Promise<RolePermissionSnapshotRecord> {
        const snapshot = parseRolePermissionSnapshot(input.snapshot);
        if (snapshot.guild.id !== input.guildId) {
            throw new Error('Role permission snapshot guild does not match its storage scope.');
        }
        const created = await this.model.create({
            guildId: input.guildId,
            guildName: input.guildName,
            createdById: input.createdById,
            snapshot,
        } as CreationAttributes<RolePermissionSnapshot>);

        await this.pruneSnapshots(input.guildId);

        return normalizeRecord(created.get({ plain: true }) as CreationAttributes<RolePermissionSnapshot>);
    }

    async getSnapshot(guildId: string, id: number): Promise<RolePermissionSnapshotRecord | null> {
        const row = await this.model.findOne({
            where: {
                guildId,
                id,
            } as WhereOptions<Attributes<RolePermissionSnapshot>>,
            raw: true,
        });

        return row ? normalizeRecord(row as unknown as CreationAttributes<RolePermissionSnapshot>) : null;
    }

    async listSnapshots(guildId: string, limit = 10): Promise<RolePermissionSnapshotRecord[]> {
        const rows = await this.model.findAll({
            where: { guildId } as WhereOptions<Attributes<RolePermissionSnapshot>>,
            order: [['createdAt', 'DESC'], ['id', 'DESC']],
            limit: clampLimit(limit),
            raw: true,
        });

        return rows.map(row => normalizeRecord(row as unknown as CreationAttributes<RolePermissionSnapshot>));
    }

    async deleteSnapshot(guildId: string, id: number): Promise<boolean> {
        const deleted = await this.model.destroy({
            where: { guildId, id } as WhereOptions<Attributes<RolePermissionSnapshot>>,
        });
        return deleted > 0;
    }

    async redactLegacySnapshots(): Promise<number> {
        const batchSize = 500;
        let lastId = 0;
        let redacted = 0;

        while (true) {
            const rows = await this.model.findAll({
                attributes: ['id', 'snapshot'],
                where: { id: { [Op.gt]: lastId } } as WhereOptions<Attributes<RolePermissionSnapshot>>,
                order: [['id', 'ASC']],
                limit: batchSize,
                raw: true,
            });
            if (rows.length === 0) return redacted;

            for (const row of rows) {
                const id = Number(row.id);
                if (!Number.isSafeInteger(id) || id <= lastId) {
                    throw new Error('Role permission snapshot has an invalid storage ID.');
                }

                let normalized;
                try {
                    normalized = normalizeRolePermissionSnapshot(row.snapshot);
                } catch (error) {
                    throw new Error(`Role permission snapshot #${id} is invalid.`, { cause: error });
                }

                if (normalized.sourceVersion === 2) {
                    await this.model.update(
                        { snapshot: normalized.snapshot } as CreationAttributes<RolePermissionSnapshot>,
                        { where: { id } as WhereOptions<Attributes<RolePermissionSnapshot>> },
                    );
                    redacted += 1;
                }
                lastId = id;
            }

            if (rows.length < batchSize) return redacted;
        }
    }

    async pruneSnapshots(guildId: string): Promise<number> {
        const retained = readRetentionLimit();
        let deletedTotal = 0;
        while (true) {
            const stale = await this.model.findAll({
                attributes: ['id'],
                where: { guildId } as WhereOptions<Attributes<RolePermissionSnapshot>>,
                order: [['createdAt', 'DESC'], ['id', 'DESC']],
                offset: retained,
                limit: 1000,
                raw: true,
            });
            const staleIds = stale.map(row => Number(row.id)).filter(Number.isSafeInteger);
            if (staleIds.length === 0) return deletedTotal;
            const deleted = await this.model.destroy({
                where: {
                    guildId,
                    id: { [Op.in]: staleIds },
                } as WhereOptions<Attributes<RolePermissionSnapshot>>,
            });
            if (deleted === 0) return deletedTotal;
            deletedTotal += deleted;
        }
    }
}

function clampLimit(value: number): number {
    if (!Number.isFinite(value)) return 10;
    return Math.min(50, Math.max(1, Math.floor(value)));
}

function normalizeRecord(row: CreationAttributes<RolePermissionSnapshot>): RolePermissionSnapshotRecord {
    return {
        id: Number(row.id),
        guildId: String(row.guildId),
        guildName: String(row.guildName),
        createdById: String(row.createdById),
        snapshot: parseRolePermissionSnapshot(row.snapshot),
        createdAt: normalizeDate(row.createdAt),
    };
}

function normalizeDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    throw new Error('Role permission snapshot timestamp is invalid.');
}

function readRetentionLimit(): number {
    const parsed = Number(process.env.ROLE_PERMISSION_SNAPSHOT_RETENTION);
    if (!Number.isSafeInteger(parsed) || parsed < 1) return DEFAULT_ROLE_PERMISSION_SNAPSHOT_RETENTION;
    return Math.min(100, parsed);
}
