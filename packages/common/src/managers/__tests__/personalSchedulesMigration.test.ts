import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('personal schedule migration', () => {
    it('supports SQLite up/down/up, durable attempt uniqueness and constrained state', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const context = { query: (sql: string) => db.query(sql) };
        const migration = await import(new URL('../../../../../migrations/20261007000600-personal-schedules.ts', import.meta.url).href) as {
            up: (value: { context: typeof context }) => Promise<void>; down: (value: { context: typeof context }) => Promise<void>;
        };
        try {
            await migration.up({ context }); await migration.down({ context }); await migration.up({ context });
            const insert = (id: string) => context.query(`INSERT INTO "ScheduleNotifications" ("id","userId","occurrenceId","attemptKey","status","attemptedAt","renderedVersion","notificationEpoch","scheduledAt","createdAt","updatedAt") VALUES ('${id}','owner','occurrence','attempt','sending',100,0,0,100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
            await insert('one'); await expect(insert('two')).rejects.toThrow();
            await expect(context.query('UPDATE "ScheduleNotifications" SET "status" = \'unsafe\'')).rejects.toThrow();
            const [rows] = await context.query('SELECT "status","notificationEpoch","scheduledAt" FROM "ScheduleNotifications"');
            expect(rows).toEqual([{ status: 'sending', notificationEpoch: 0, scheduledAt: 100 }]);
        } finally { await db.close(); }
    });
});
