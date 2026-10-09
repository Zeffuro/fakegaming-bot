import { describe, expect, it } from 'vitest';
import { Sequelize } from 'sequelize-typescript';

describe('reminder interaction migration', () => {
    it('supports SQLite up/down/up, single occurrence uniqueness and valid persisted states', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const context = { query: async (sql: string) => db.query(sql) };
        const migrationPath = new URL('../../../../../migrations/20261007000200-reminder-interactions.ts', import.meta.url).href;
        const { up, down } = await import(migrationPath) as {
            up: (input: { context: typeof context }) => Promise<void>;
            down: (input: { context: typeof context }) => Promise<void>;
        };
        try {
            await up({ context });
            await context.query(`INSERT INTO "ReminderDeliveries"
                ("id", "reminderId", "scheduledAt", "sourceTimestamp", "userId", "message", "expiresAt", "createdAt", "updatedAt")
                VALUES ('one', 'source', 1, 1, 'owner', 'task', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
            await expect(context.query(`INSERT INTO "ReminderDeliveries"
                ("id", "reminderId", "scheduledAt", "sourceTimestamp", "userId", "message", "expiresAt", "createdAt", "updatedAt")
                VALUES ('two', 'source', 1, 1, 'owner', 'task', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)).rejects.toThrow();
            await expect(context.query('UPDATE "ReminderDeliveries" SET "status" = \'invalid\'')).rejects.toThrow();
            await context.query('UPDATE "ReminderDeliveries" SET "status" = \'sending\', "attemptedAt" = 2');
            const [rows] = await context.query('SELECT "status", "finalized" FROM "ReminderDeliveries"');
            expect(rows).toEqual([{ status: 'sending', finalized: 0 }]);
            await down({ context });
            await up({ context });
            const [fresh] = await context.query('SELECT * FROM "ReminderDeliveries"');
            expect(fresh).toEqual([]);
        } finally {
            await db.close();
        }
    });
});
