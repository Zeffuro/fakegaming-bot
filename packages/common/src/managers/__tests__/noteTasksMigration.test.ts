import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('note task migration', () => {
    it('preserves rows, enforces nullable per-owner uniqueness and round-trips SQLite', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const migration = await import(new URL('../../../../../migrations/20261009000400-note-tasks.ts', import.meta.url).href);
        try {
            await db.query('CREATE TABLE "UserTasks" ("id" TEXT PRIMARY KEY, "userId" TEXT, "title" TEXT)');
            await db.query('CREATE TABLE "UserNoteConfigs" ("id" TEXT PRIMARY KEY, "body" TEXT)');
            await db.query(`INSERT INTO "UserTasks" VALUES ('old', 'owner', 'Keep task')`);
            await db.query(`INSERT INTO "UserNoteConfigs" VALUES ('note', 'Keep note')`);
            await migration.up({ context: db });
            expect((await db.query('SELECT "title", "sourceNoteId", "sourceUrl" FROM "UserTasks"'))[0]).toEqual([{ title: 'Keep task', sourceNoteId: null, sourceUrl: null }]);
            expect((await db.query('SELECT "body", "linkedTaskId" FROM "UserNoteConfigs"'))[0]).toEqual([{ body: 'Keep note', linkedTaskId: null }]);
            await db.query(`INSERT INTO "UserTasks" ("id", "userId", "sourceNoteId") VALUES ('one', 'owner', 'note'), ('two', 'other', 'note'), ('three', 'owner', NULL)`);
            await expect(db.query(`INSERT INTO "UserTasks" ("id", "userId", "sourceNoteId") VALUES ('duplicate', 'owner', 'note')`)).rejects.toThrow();
            await migration.down({ context: db });
            expect((await db.query('SELECT "body" FROM "UserNoteConfigs"'))[0]).toEqual([{ body: 'Keep note' }]);
            await migration.up({ context: db });
            expect((await db.query('SELECT "title" FROM "UserTasks" WHERE "id" = \'old\''))[0]).toEqual([{ title: 'Keep task' }]);
        } finally { await db.close(); }
    });
});
