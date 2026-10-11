import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('task completion undo migration', () => {
    it('preserves existing tasks across SQLite up/down/up and defaults legacy undo to null', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const context = { query: (sql: string) => db.query(sql) };
        const path = new URL('../../../../../migrations/20261010000100-task-completion-undo.ts', import.meta.url).href;
        const { up, down } = await import(path) as { up(input: { context: typeof context }): Promise<void>; down(input: { context: typeof context }): Promise<void> };
        try {
            await context.query('CREATE TABLE "UserTasks" ("id" VARCHAR(64) PRIMARY KEY, "checklistJson" TEXT, "dueAt" BIGINT)');
            await context.query(`INSERT INTO "UserTasks" VALUES ('keep', '[{"text":"Keep","done":true}]', 123)`);
            await up({ context });
            expect((await db.query('SELECT "undoCompletionJson" FROM "UserTasks"'))[0]).toEqual([{ undoCompletionJson: null }]);
            await context.query(`UPDATE "UserTasks" SET "undoCompletionJson" = '{"version":1}' WHERE "id" = 'keep'`);
            await down({ context });
            await up({ context });
            expect((await db.query('SELECT * FROM "UserTasks"'))[0]).toEqual([{ id: 'keep', checklistJson: '[{"text":"Keep","done":true}]', dueAt: 123, undoCompletionJson: null }]);
        } finally { await db.close(); }
    });
});
