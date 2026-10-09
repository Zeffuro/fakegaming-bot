import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('note inbox migration', () => {
    it('preserves legacy notes and round-trips SQLite columns', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const migrationPath = new URL('../../../../../migrations/20261007000300-note-inbox.ts', import.meta.url).href;
        const migration = await import(migrationPath);
        try {
            await db.query('CREATE TABLE "UserNoteConfigs" ("id" TEXT PRIMARY KEY, "discordId" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "pinned" BOOLEAN NOT NULL DEFAULT 0, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP)');
            await db.query(`INSERT INTO "UserNoteConfigs" ("id", "discordId", "title", "body") VALUES ('old', 'owner', 'Legacy', 'Preserve me')`);
            await migration.up({ context: db });
            const [rows] = await db.query('SELECT "status", "tags", "sourceUrl", "body" FROM "UserNoteConfigs"');
            expect(rows).toEqual([{ status: 'unread', tags: '[]', sourceUrl: null, body: 'Preserve me' }]);
            await expect(db.query(`UPDATE "UserNoteConfigs" SET "status" = 'unknown'`)).rejects.toThrow();
            await migration.down({ context: db });
            const [original] = await db.query('SELECT "body" FROM "UserNoteConfigs"');
            expect(original).toEqual([{ body: 'Preserve me' }]);
            await migration.up({ context: db });
            const [restored] = await db.query('SELECT "status" FROM "UserNoteConfigs"');
            expect(restored).toEqual([{ status: 'unread' }]);
        } finally { await db.close(); }
    });
});
