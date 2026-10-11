import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('ranked poll migration', () => {
    it('round-trips SQLite defaults, mode checks and existing vote order', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const migration = await import(new URL('../../../../../migrations/20261010000400-ranked-polls.ts', import.meta.url).href);
        try {
            for (const table of ['PollSessions', 'PollTemplates']) {
                await db.query(`CREATE TABLE "${table}" ("id" TEXT PRIMARY KEY, "allowMultiple" BOOLEAN NOT NULL DEFAULT FALSE, "votesJson" TEXT)`);
                await db.query(`INSERT INTO "${table}" VALUES ('old', FALSE, '[["voter",[2,0,1]]]')`);
            }
            await migration.up({ context: db });
            for (const table of ['PollSessions', 'PollTemplates']) {
                expect((await db.query(`SELECT "ranked", "votesJson" FROM "${table}"`))[0]).toEqual([{ ranked: 0, votesJson: '[["voter",[2,0,1]]]' }]);
                await expect(db.query(`UPDATE "${table}" SET "ranked" = TRUE, "allowMultiple" = TRUE`)).rejects.toThrow();
                await db.query(`UPDATE "${table}" SET "ranked" = TRUE`);
            }
            await migration.down({ context: db }); await migration.up({ context: db });
            expect((await db.query('SELECT "ranked", "votesJson" FROM "PollSessions"'))[0]).toEqual([{ ranked: 0, votesJson: '[["voter",[2,0,1]]]' }]);
        } finally { await db.close(); }
    });
});
