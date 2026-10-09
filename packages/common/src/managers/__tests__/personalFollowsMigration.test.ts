import { Sequelize } from 'sequelize';
import { describe, it, expect } from 'vitest';

describe('personal follow and preset migration', () => {
    it('supports up/down/up with unique owner/target and event bindings', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const context = { query: (sql: string) => db.query(sql) };
        const migration = await import(new URL('../../../../../migrations/20261007000500-personal-follows-presets.ts', import.meta.url).href) as {
            up: (value: { context: typeof context }) => Promise<void>; down: (value: { context: typeof context }) => Promise<void>;
        };
        try {
            await migration.up({ context }); await migration.down({ context }); await migration.up({ context });
            const insert = (id: string) => context.query(`INSERT INTO "UserFollows" ("id","userId","provider","target","label","createdAt","updatedAt") VALUES ('${id}','owner','twitch','example','Example',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
            await insert('one'); await expect(insert('two')).rejects.toThrow();
            await expect(context.query('UPDATE "UserFollows" SET "mode" = \'unsafe\'')).rejects.toThrow();
            const [rows] = await context.query('SELECT "mode", "paused" FROM "UserFollows"');
            expect(rows).toEqual([{ mode: 'immediate', paused: 0 }]);
        } finally { await db.close(); }
    });
});
