import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('morning briefing additive migration', () => {
    it('keeps defaults private, enforces daily uniqueness and round-trips SQLite', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const migration = await import(new URL('../../../../../migrations/20261010000200-morning-briefings.ts', import.meta.url).href);
        try {
            await db.query('CREATE TABLE "UserConfigs" ("discordId" TEXT PRIMARY KEY, "timezone" TEXT)');
            await db.query(`INSERT INTO "UserConfigs" VALUES ('old', 'Europe/Amsterdam')`);
            await migration.up({ context: db });
            await db.query(`INSERT INTO "MorningBriefingSettings" ("userId", "createdAt", "updatedAt") VALUES ('owner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
            expect((await db.query('SELECT "enabled", "localTime", "version" FROM "MorningBriefingSettings"'))[0]).toEqual([{ enabled: 0, localTime: '09:00', version: 0 }]);
            const insert = (id: string) => db.query(`INSERT INTO "MorningBriefingDeliveries" ("id", "userId", "localDate", "timezone", "settingsVersion", "status", "claimToken", "attemptedAt", "createdAt", "updatedAt") VALUES ('${id}', 'owner', '2026-10-10', 'UTC', 0, 'sending', 'claim', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
            await insert('one'); await expect(insert('two')).rejects.toThrow();
            await migration.down({ context: db }); await migration.up({ context: db });
            expect((await db.query('SELECT "timezone" FROM "UserConfigs"'))[0]).toEqual([{ timezone: 'Europe/Amsterdam' }]);
        } finally { await db.close(); }
    });
});
