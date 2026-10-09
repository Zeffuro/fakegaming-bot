import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('persistent poll migration', () => {
    it('supports SQLite up/down/up and enforces unique bindings and final-state consistency', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const context = { query: (sql: string) => db.query(sql) };
        const migrationPath = new URL('../../../../../migrations/20261007000100-persistent-polls.ts', import.meta.url).href;
        const { up, down } = await import(migrationPath) as {
            up: (input: { context: typeof context }) => Promise<void>;
            down: (input: { context: typeof context }) => Promise<void>;
        };
        try {
            await up({ context });
            await down({ context });
            await up({ context });
            const insert = (id: string, extra = 'NULL, NULL') => db.query(`INSERT INTO "PollSessions"
                ("id", "guildId", "channelId", "messageId", "creatorId", "question", "optionsJson", "votesJson",
                 "allowMultiple", "locale", "expiresAt", "closedAt", "closeReason", "renderPending", "version", "createdAt", "updatedAt")
                VALUES ('${id}', 'guild', 'channel', 'message', 'creator', 'Choose?', '["A","B"]', '[]',
                false, 'en', 123, ${extra}, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
            await insert('one');
            await expect(insert('two')).rejects.toThrow();
            await db.query('DELETE FROM "PollSessions"');
            await expect(insert('invalid', "123, NULL")).rejects.toThrow();
            await insert('closed', "123, 'expired'");
            const [rows] = await db.query('SELECT * FROM "PollSessions"');
            expect(rows).toHaveLength(1);
        } finally {
            await db.close();
        }
    });
});
