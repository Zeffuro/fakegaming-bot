import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('../../../../../migrations/20261011000200-scoped-notification-delivery.ts', import.meta.url).href;

async function createLegacy(db: Sequelize): Promise<void> {
    const initial = await import(new URL('../../../../../migrations/20251015-create-notifications.ts', import.meta.url).href);
    await initial.up({ context: db });
    await db.query('CREATE INDEX "ix_notification_channel_custom" ON "Notifications" ("channelId")');
    await db.query(`INSERT INTO "Notifications" ("id","provider","eventId","guildId","channelId","messageId","createdAt","updatedAt")
        VALUES (7,'youtube','legacy-video','guild-1','channel-1','message-1','2026-10-01 12:00:00','2026-10-01 12:01:00'),
        (8,'youtube','global-video',NULL,NULL,NULL,'2026-10-02 12:00:00','2026-10-02 12:01:00'),
        (999,'youtube','deleted',NULL,NULL,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
    await db.query('DELETE FROM "Notifications" WHERE "id" = 999');
}

describe('scoped notification delivery migration', () => {
    it('preserves legacy receipts, metadata, indexes and identity sequence through SQLite up/down/up', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const migration = await import(migrationPath);
        try {
            await createLegacy(db);
            const [before] = await db.query('SELECT * FROM "Notifications" ORDER BY "id"');
            await migration.up({ context: db });
            const [after] = await db.query('SELECT * FROM "Notifications" ORDER BY "id"');
            expect(after).toEqual(before.map((row, index) => ({ ...row as object, scopeKey: index ? '' : 'guild-1', deliveryStatus: 'sent' })));
            const [indexes] = await db.query('PRAGMA index_list("Notifications")');
            expect(indexes).toEqual(expect.arrayContaining([
                expect.objectContaining({ name: 'ix_notifications_provider' }),
                expect.objectContaining({ name: 'ix_notifications_createdAt' }),
                expect.objectContaining({ name: 'ix_notification_channel_custom' }),
            ]));
            await expect(db.query(`INSERT INTO "Notifications" ("provider","eventId","guildId","scopeKey") VALUES ('youtube','legacy-video','guild-1','guild-1')`)).rejects.toThrow();
            await expect(db.query(`UPDATE "Notifications" SET "scopeKey" = NULL`)).rejects.toThrow();
            await expect(db.query(`UPDATE "Notifications" SET "deliveryStatus" = 'failed'`)).rejects.toThrow();
            await migration.down({ context: db });
            expect((await db.query('SELECT * FROM "Notifications" ORDER BY "id"'))[0]).toEqual(before);
            await migration.up({ context: db });
            await db.query(`INSERT INTO "Notifications" ("provider","eventId","guildId","scopeKey") VALUES ('youtube','legacy-video','guild-2','guild-2')`);
            const [added] = await db.query('SELECT "id", "deliveryStatus" FROM "Notifications" WHERE "guildId" = \'guild-2\'');
            expect(added).toEqual([{ id: 1000, deliveryStatus: 'sent' }]);
            await expect(migration.down({ context: db })).rejects.toThrow('Cannot roll back scoped notifications');
            expect((await db.query('SELECT COUNT(*) AS "count" FROM "Notifications"'))[0]).toEqual([{ count: 3 }]);
            expect((await db.query('SELECT "scopeKey" FROM "Notifications" WHERE "guildId" = \'guild-2\''))[0]).toEqual([{ scopeKey: 'guild-2' }]);
        } finally {
            await db.close();
        }
    });

    it.each(['sending', 'uncertain'])('rejects a rollback with %s receipts before changing the table', async status => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const migration = await import(migrationPath);
        try {
            await createLegacy(db);
            await migration.up({ context: db });
            await db.query('UPDATE "Notifications" SET "deliveryStatus" = :status WHERE "id" = 7', { replacements: { status } });
            await expect(migration.down({ context: db })).rejects.toThrow('Cannot roll back scoped notifications');
            expect((await db.query('SELECT "scopeKey", "deliveryStatus" FROM "Notifications" WHERE "id" = 7'))[0])
                .toEqual([{ scopeKey: 'guild-1', deliveryStatus: status }]);
        } finally {
            await db.close();
        }
    });
});
