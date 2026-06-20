import { beforeEach, describe, expect, it } from 'vitest';
import type { CreationAttributes } from 'sequelize';
import { AuditEvent, type AuditActorType, type AuditEventSeverity, type AuditEventStatus } from '../../models/audit-event.js';
import { configManager } from '../../vitest.setup.js';

describe('AuditEventManager', () => {
    const manager = configManager.auditEventManager;

    beforeEach(async () => {
        await manager.removeAll();
    });

    it('records an audit event with safe defaults', async () => {
        const event = await manager.record({
            action: 'config.create',
            targetType: 'twitchConfig',
        });

        expect(event.id).toBeGreaterThan(0);
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.actorId).toBeNull();
        expect(event.actorType).toBe('user');
        expect(event.targetId).toBeNull();
        expect(event.guildId).toBeNull();
        expect(event.severity).toBe('info');
        const auditStatus = event.status;
        expect(auditStatus).toBe('success');
        expect(event.requestId).toBeNull();
        expect(event.metadata).toBeNull();
    });

    it('lists filtered audit events with clamped pagination', async () => {
        await manager.record({
            timestamp: new Date('2026-01-01T00:00:00.000Z'),
            actorId: 'user-1',
            actorType: 'user',
            action: 'config.create',
            targetType: 'twitchConfig',
            targetId: '1',
            guildId: 'guild-1',
            severity: 'info',
            status: 'success',
            requestId: 'req-1',
            metadata: { channelId: 'channel-1' },
        });
        await manager.record({
            timestamp: new Date('2026-01-02T00:00:00.000Z'),
            actorId: 'service-1',
            actorType: 'service',
            action: 'config.delete',
            targetType: 'youtubeConfig',
            targetId: '2',
            guildId: 'guild-2',
            severity: 'warn',
            status: 'failure',
            requestId: 'req-2',
            metadata: { channelId: 'channel-2' },
        });

        const result = await manager.list({
            limit: 500,
            offset: -10,
            action: 'config.delete',
            targetType: 'youtubeConfig',
            actorId: 'service-1',
            guildId: 'guild-2',
            severity: 'warn',
            status: 'failure',
        });

        expect(result.limit).toBe(200);
        expect(result.offset).toBe(0);
        expect(result.total).toBe(1);
        expect(result.events).toHaveLength(1);
        expect(result.events[0]).toMatchObject({
            actorId: 'service-1',
            actorType: 'service',
            action: 'config.delete',
            targetType: 'youtubeConfig',
            targetId: '2',
            guildId: 'guild-2',
            severity: 'warn',
            status: 'failure',
            requestId: 'req-2',
            metadata: { channelId: 'channel-2' },
        });
    });

    it('normalizes malformed legacy rows while listing', async () => {
        await AuditEvent.create({
            timestamp: new Date('2026-01-03T00:00:00.000Z'),
            actorId: '',
            actorType: 'robot' as AuditActorType,
            action: 'legacy.action',
            targetType: 'legacyTarget',
            targetId: '',
            guildId: '',
            severity: 'debug' as AuditEventSeverity,
            status: 'pending' as AuditEventStatus,
            requestId: '',
            metadata: 'not-json' as unknown as Record<string, unknown>,
        } as CreationAttributes<AuditEvent>);

        const result = await manager.list({ action: 'legacy.action' });

        expect(result.events[0]).toMatchObject({
            actorId: null,
            actorType: 'user',
            targetId: null,
            guildId: null,
            severity: 'info',
            status: 'success',
            requestId: null,
            metadata: { raw: 'not-json' },
        });
    });

    it('cleans up events older than the clamped retention window', async () => {
        await manager.record({
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            action: 'old.action',
            targetType: 'auditEvent',
        });
        await manager.record({
            timestamp: new Date(),
            action: 'new.action',
            targetType: 'auditEvent',
        });

        const deleted = await manager.cleanupOlderThan(0);
        const remaining = await manager.list({ limit: Number.POSITIVE_INFINITY });

        expect(deleted).toBe(1);
        expect(remaining.limit).toBe(1);
        expect(remaining.events).toHaveLength(1);
        expect(remaining.events[0].action).toBe('new.action');
    });
});
