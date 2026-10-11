import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('hidden poll results migration', () => {
    it('defaults existing and new polls to live results and preserves votes through up/down/up', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const context = { query: (sql: string) => db.query(sql) };
        const original = await import(new URL('../../../../../migrations/20261007000100-persistent-polls.ts', import.meta.url).href);
        const migration = await import(new URL('../../../../../migrations/20261009000300-hidden-poll-results.ts', import.meta.url).href);
        const insert = (id: string) => context.query(`INSERT INTO "PollSessions"
            ("id", "guildId", "channelId", "messageId", "creatorId", "question", "optionsJson", "votesJson",
             "allowMultiple", "locale", "expiresAt", "renderPending", "version", "createdAt", "updatedAt")
            VALUES ('${id}', 'guild', 'channel', '${id}', 'creator', 'Choose?', '["A","B"]', '[["voter",[1]]]',
             false, 'en', 123, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
        try {
            await original.up({ context });
            await insert('existing');
            await migration.up({ context });
            await insert('new');
            const [defaults] = await context.query('SELECT "id", "hideResults" FROM "PollSessions" ORDER BY "id"');
            expect(defaults).toEqual([{ id: 'existing', hideResults: 0 }, { id: 'new', hideResults: 0 }]);
            await context.query('UPDATE "PollSessions" SET "hideResults" = true WHERE "id" = \'new\'');
            await expect(context.query('UPDATE "PollSessions" SET "hideResults" = NULL')).rejects.toThrow();
            await migration.down({ context });
            expect((await db.getQueryInterface().describeTable('PollSessions')).hideResults).toBeUndefined();
            await migration.up({ context });
            const [restored] = await context.query('SELECT "hideResults", "votesJson" FROM "PollSessions" ORDER BY "id"');
            expect(restored).toEqual([
                { hideResults: 0, votesJson: '[["voter",[1]]]' }, { hideResults: 0, votesJson: '[["voter",[1]]]' },
            ]);
        } finally {
            await db.close();
        }
    });
});
