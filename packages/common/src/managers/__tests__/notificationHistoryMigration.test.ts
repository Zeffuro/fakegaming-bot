import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('private notification history migration', () => {
    it('round-trips SQLite, enforces allowed values and uniqueness, and preserves unrelated user data', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const migration = await import(new URL('../../../../../migrations/20261011000100-personal-notification-history.ts', import.meta.url).href);
        try {
            await db.query('CREATE TABLE "UserConfigs" ("discordId" TEXT PRIMARY KEY, "timezone" TEXT)');
            await db.query(`INSERT INTO "UserConfigs" VALUES ('existing', 'Europe/Amsterdam')`);
            await migration.up({ context: db });
            const insert = (id: string, kind = 'reminder', status = 'sent', reason: string | null = null) => db.query(
                'INSERT INTO "PersonalNotificationHistory" ("id","userId","kind","occurrenceKey","title","status","reason","scheduledAt","updatedAt") VALUES (:id, :owner, :kind, :key, :title, :status, :reason, :time, :time)',
                { replacements: { id, owner: 'owner', kind, key: 'occurrence', title: 'Private title', status, reason, time: 1_800_000_000_000 } });
            await insert('one'); await expect(insert('duplicate')).rejects.toThrow();
            await expect(insert('bad-kind', 'public')).rejects.toThrow();
            await expect(insert('bad-status', 'anime', 'delivered')).rejects.toThrow();
            await expect(insert('bad-reason', 'anime', 'failed', 'database-secret')).rejects.toThrow();
            await db.query('INSERT INTO "PersonalNotificationHistory" ("id","userId","kind","occurrenceKey","title","status","scheduledAt","updatedAt") VALUES (:id,:owner,:kind,:key,:title,:status,:time,:time)',
                { replacements: { id: 'other', owner: 'another', kind: 'reminder', key: 'occurrence', title: '', status: 'uncertain', time: 1_800_000_000_001 } });
            expect((await db.query('SELECT "scheduledAt" FROM "PersonalNotificationHistory" WHERE "id" = \'other\''))[0]).toEqual([{ scheduledAt: 1_800_000_000_001 }]);
            await migration.down({ context: db }); await migration.up({ context: db });
            expect((await db.query('SELECT * FROM "UserConfigs"'))[0]).toEqual([{ discordId: 'existing', timezone: 'Europe/Amsterdam' }]);
        } finally { await db.close(); }
    });
});
