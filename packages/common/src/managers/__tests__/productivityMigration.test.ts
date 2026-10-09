import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('personal productivity migration', () => {
    it('creates all three SQLite schemas, survives down/up and enforces one active session per owner', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const context = { query: (sql: string) => db.query(sql) };
        const path = new URL('../../../../../migrations/20261007000400-personal-productivity.ts', import.meta.url).href;
        const { up, down } = await import(path) as { up(input: { context: typeof context }): Promise<void>; down(input: { context: typeof context }): Promise<void> };
        try {
            await up({ context });
            await down({ context });
            await up({ context });
            await context.query(`INSERT INTO "UserTasks" ("id", "userId", "title", "checklistJson", "state", "timezone", "version", "completions", "createdAt", "updatedAt")
                VALUES ('task', 'owner', 'Title', '[]', 'active', 'UTC', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
            await context.query(`INSERT INTO "UserCountdowns" ("id", "userId", "title", "dueAt", "timezone", "reminderIdsJson", "createdAt", "updatedAt")
                VALUES ('countdown', 'owner', 'Title', 123, 'UTC', '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
            const session = (id: string, owner = 'owner') => context.query(`INSERT INTO "UserSessions"
                ("id", "userId", "title", "kind", "state", "activeKey", "startedAt", "runningSince", "workMs", "breakElapsedMs", "phaseElapsedMs",
                "pomodoro", "phase", "breakMs", "cycles", "cycleIndex", "messagesJson", "version", "createdAt", "updatedAt")
                VALUES ('${id}', '${owner}', 'Title', 'focus', 'running', '${owner}', 100, 100, 0, 0, 0, false, 'focus', 60000, 1, 1, '{}', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
            await session('first');
            await expect(session('duplicate')).rejects.toThrow();
            await session('other', 'other');
            await expect(context.query(`UPDATE "UserSessions" SET "workMs" = -1 WHERE "id" = 'first'`)).rejects.toThrow();
            await expect(context.query(`UPDATE "UserTasks" SET "state" = 'bad'`)).rejects.toThrow();
            const [countdowns] = await db.query('SELECT * FROM "UserCountdowns"');
            expect(countdowns).toHaveLength(1);
        } finally { await db.close(); }
    });
});
