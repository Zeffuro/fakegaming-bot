import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';
describe('personal notification pause migration', () => {
    it('preserves unrelated rows through SQLite up/down/up and defaults automatic notifications on', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }); const context = { query: (sql: string) => db.query(sql) };
        const path = new URL('../../../../../migrations/20261010000600-personal-notification-pause.ts', import.meta.url).href;
        const { up, down } = await import(path) as { up(input: { context: typeof context }): Promise<void>; down(input: { context: typeof context }): Promise<void> };
        const insert = `INSERT INTO "PersonalNotificationPauses" ("userId", "createdAt", "updatedAt") VALUES ('owner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        try {
            await context.query('CREATE TABLE "Kept" ("id" INTEGER)'); await context.query('INSERT INTO "Kept" VALUES (1)');
            await up({ context }); await context.query(insert);
            expect((await db.query('SELECT "enabled", "resumeAt", "version" FROM "PersonalNotificationPauses"'))[0]).toEqual([{ enabled: 0, resumeAt: null, version: 0 }]);
            await expect(context.query(insert)).rejects.toThrow(); await expect(context.query('UPDATE "PersonalNotificationPauses" SET "version" = -1')).rejects.toThrow();
            await down({ context }); await up({ context }); await context.query(insert);
            expect((await db.query('SELECT * FROM "Kept"'))[0]).toEqual([{ id: 1 }]);
        } finally { await db.close(); }
    });
});
