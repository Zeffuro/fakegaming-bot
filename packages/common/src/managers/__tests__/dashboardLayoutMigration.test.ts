import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('dashboard layout migration', () => {
    it('supports SQLite up/down/up with owner uniqueness and bounded defaults', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const context = { query: (sql: string) => db.query(sql) };
        const path = new URL('../../../../../migrations/20261010000500-dashboard-layout.ts', import.meta.url).href;
        const { up, down } = await import(path) as { up(input: { context: typeof context }): Promise<void>; down(input: { context: typeof context }): Promise<void> };
        const insert = `INSERT INTO "UserDashboardLayouts" ("userId", "sectionsJson", "createdAt", "updatedAt") VALUES ('owner', '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        try {
            await context.query('CREATE TABLE "Kept" ("id" INTEGER)'); await context.query('INSERT INTO "Kept" VALUES (1)');
            await up({ context }); await context.query(insert);
            expect((await db.query('SELECT "version", "schemaVersion" FROM "UserDashboardLayouts"'))[0]).toEqual([{ version: 0, schemaVersion: 1 }]);
            await expect(context.query(insert)).rejects.toThrow();
            await expect(context.query('UPDATE "UserDashboardLayouts" SET "version" = -1')).rejects.toThrow();
            await expect(context.query('UPDATE "UserDashboardLayouts" SET "schemaVersion" = 2')).rejects.toThrow();
            await down({ context }); await up({ context }); await context.query(insert);
            expect((await db.query('SELECT * FROM "Kept"'))[0]).toEqual([{ id: 1 }]);
        } finally { await db.close(); }
    });
});
