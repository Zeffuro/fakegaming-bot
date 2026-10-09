import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('calendar publishing migration', () => {
    it('supports SQLite up/down/up, opt-in defaults and unique constrained destinations and deliveries', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const context = { query: (sql: string) => db.query(sql) };
        const migration = await import(new URL('../../../../../migrations/20261009000100-calendar-publications.ts', import.meta.url).href) as {
            up(value: { context: typeof context }): Promise<void>; down(value: { context: typeof context }): Promise<void>;
        };
        try {
            await context.query('CREATE TABLE "LegacyHistory" ("note" TEXT)'); await context.query("INSERT INTO \"LegacyHistory\" VALUES ('Retained')");
            await migration.up({ context }); await migration.down({ context }); await migration.up({ context });
            const base = `"userId","sourceId","guildId","channelId","guildName","channelName","lookaheadDays","createdAt","updatedAt"`;
            const values = `'owner','source','guild','channel','Server','reminders',180,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP`;
            await context.query(`INSERT INTO "CalendarPublications" ("id",${base}) VALUES ('first',${values})`);
            const [rows] = await context.query('SELECT "enabled","eventLeadDays","version" FROM "CalendarPublications"');
            expect(rows).toEqual([{ enabled: 0, eventLeadDays: null, version: 1 }]);
            await expect(context.query(`INSERT INTO "CalendarPublications" ("id",${base}) VALUES ('duplicate',${values})`)).rejects.toThrow();
            for (const change of ['"lookaheadDays" = 366', '"eventLeadDays" = 0', '"version" = 0']) await expect(context.query(`UPDATE "CalendarPublications" SET ${change}`)).rejects.toThrow();
            const delivery = `"publicationId","occurrenceId","kind","status","attemptedAt","createdAt","updatedAt"`;
            const deliveryValues = `'first','occurrence','message','uncertain',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP`;
            await context.query(`INSERT INTO "CalendarPublicationDeliveries" ("id",${delivery}) VALUES ('delivery',${deliveryValues})`);
            await expect(context.query(`INSERT INTO "CalendarPublicationDeliveries" ("id",${delivery}) VALUES ('duplicate',${deliveryValues})`)).rejects.toThrow();
            await expect(context.query(`UPDATE "CalendarPublicationDeliveries" SET "status" = 'invalid'`)).rejects.toThrow();
            await migration.down({ context });
            const [history] = await context.query('SELECT * FROM "LegacyHistory"'); expect(history).toEqual([{ note: 'Retained' }]);
        } finally { await db.close(); }
    });
});
