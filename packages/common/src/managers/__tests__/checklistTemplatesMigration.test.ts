import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('checklist template migration', () => {
    it('adds bounded required fields without altering existing tasks and round-trips SQLite', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const migration = await import(new URL('../../../../../migrations/20261009000500-checklist-templates.ts', import.meta.url).href);
        try {
            await db.query('CREATE TABLE "UserTasks" ("id" TEXT PRIMARY KEY, "title" TEXT)');
            await db.query(`INSERT INTO "UserTasks" VALUES ('old', 'Keep task')`);
            await migration.up({ context: db });
            await db.query(`INSERT INTO "UserChecklistTemplates" ("id", "userId", "title", "itemsJson", "createdAt", "updatedAt") VALUES ('list', 'owner', 'Packing', '["Passport"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
            expect((await db.query('SELECT "version" FROM "UserChecklistTemplates"'))[0]).toEqual([{ version: 0 }]);
            await expect(db.query(`INSERT INTO "UserChecklistTemplates" ("id", "title", "itemsJson", "createdAt", "updatedAt") VALUES ('bad', 'Missing owner', '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)).rejects.toThrow();
            await migration.down({ context: db });
            await migration.up({ context: db });
            expect((await db.query('SELECT "title" FROM "UserTasks"'))[0]).toEqual([{ title: 'Keep task' }]);
        } finally { await db.close(); }
    });
});
