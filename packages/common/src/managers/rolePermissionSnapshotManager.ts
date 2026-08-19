import { Attributes, CreationAttributes, WhereOptions } from 'sequelize';
import { BaseManager } from './baseManager.js';
import {
    RolePermissionSnapshot,
    type RolePermissionSnapshotData,
} from '../models/role-permission-snapshot.js';

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
        const created = await this.model.create({
            guildId: input.guildId,
            guildName: input.guildName,
            createdById: input.createdById,
            snapshot: input.snapshot,
        } as CreationAttributes<RolePermissionSnapshot>);

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
        snapshot: normalizeSnapshot(row.snapshot),
        createdAt: normalizeDate(row.createdAt),
    };
}

function normalizeSnapshot(value: unknown): RolePermissionSnapshotData {
    if (typeof value === 'string') {
        return normalizeSnapshot(JSON.parse(value) as unknown);
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as RolePermissionSnapshotData;
    }

    throw new Error('Role permission snapshot data is invalid.');
}

function normalizeDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
}
