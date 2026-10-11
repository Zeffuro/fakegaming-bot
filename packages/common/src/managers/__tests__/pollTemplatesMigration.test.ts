import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('poll template migration', () => {
    it('round-trips SQLite with private defaults and preserves old polls', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const migration = await import(new URL('../../../../../migrations/20261010000300-poll-templates.ts', import.meta.url).href);
        try {
            await db.query('CREATE TABLE "PollSessions" ("id" TEXT PRIMARY KEY, "votesJson" TEXT)');
            await db.query(`INSERT INTO "PollSessions" VALUES ('old', '[["voter",[0]]]')`);
            await migration.up({ context: db });
            const insert = (id: string, minutes: number) => db.query(`INSERT INTO "PollTemplates" ("id", "userId", "title", "question", "optionsJson", "durationMinutes", "createdAt", "updatedAt") VALUES ('${id}', 'owner', 'Dinner', 'Food?', '["A","B"]', ${minutes}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
            await insert('saved', 10);
            expect((await db.query('SELECT "version", "allowMultiple", "hideResults" FROM "PollTemplates"'))[0]).toEqual([{ version: 0, allowMultiple: 0, hideResults: 0 }]);
            await expect(insert('bad', 0)).rejects.toThrow(); await expect(insert('bad', 1441)).rejects.toThrow();
            await migration.down({ context: db }); await migration.up({ context: db });
            expect((await db.query('SELECT "votesJson" FROM "PollSessions"'))[0]).toEqual([{ votesJson: '[["voter",[0]]]' }]);
        } finally { await db.close(); }
    });
});
