import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('Google Calendar migration', () => {
    it('supports SQLite up/down/up and constrains connection state and monotonic versions', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const context = { query: (sql: string) => db.query(sql) };
        const migration = await import(new URL('../../../../../migrations/20261007000700-google-calendar.ts', import.meta.url).href) as { up(value: { context: typeof context }): Promise<void>; down(value: { context: typeof context }): Promise<void> };
        try {
            await migration.up({ context }); await migration.down({ context }); await migration.up({ context });
            await context.query(`INSERT INTO "CalendarConnections" ("userId","createdAt","updatedAt") VALUES ('owner',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
            const [rows] = await context.query('SELECT "status", "version", "encryptedAccessToken" FROM "CalendarConnections"');
            expect(rows).toEqual([{ status: 'disconnected', version: 1, encryptedAccessToken: null }]);
            await expect(context.query(`UPDATE "CalendarConnections" SET "status" = 'unknown'`)).rejects.toThrow();
            await expect(context.query('UPDATE "CalendarConnections" SET "version" = 0')).rejects.toThrow();
        } finally { await db.close(); }
    });
});
