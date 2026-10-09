import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

describe('calendar publication details migration', () => {
    it('adds private defaults to existing and new publications and reverses without losing history', async () => {
        const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        const context = { query: (sql: string) => db.query(sql) };
        const original = await import(new URL('../../../../../migrations/20261009000100-calendar-publications.ts', import.meta.url).href);
        const migration = await import(new URL('../../../../../migrations/20261009000200-calendar-publication-details.ts', import.meta.url).href);
        try {
            await original.up({ context });
            const base = '"userId","sourceId","guildId","channelId","guildName","channelName","lookaheadDays","enabled","createdAt","updatedAt"';
            const values = "'owner','source','guild','channel','Server','reminders',180,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP";
            await context.query(`INSERT INTO "CalendarPublications" ("id",${base}) VALUES ('existing',${values})`);
            await migration.up({ context });
            await context.query(`INSERT INTO "CalendarPublications" ("id",${base}) VALUES ('new',${values.replace("'channel'", "'second'")})`);
            const [rows] = await context.query('SELECT "includeEventDetails","enabled" FROM "CalendarPublications" ORDER BY "id"');
            expect(rows).toEqual([{ includeEventDetails: 0, enabled: 1 }, { includeEventDetails: 0, enabled: 1 }]);
            await context.query('UPDATE "CalendarPublications" SET "includeEventDetails" = true WHERE "id" = \'existing\'');
            await expect(context.query('UPDATE "CalendarPublications" SET "includeEventDetails" = NULL')).rejects.toThrow();
            await migration.down({ context }); await migration.up({ context });
            const [restored] = await context.query('SELECT "id","includeEventDetails" FROM "CalendarPublications" ORDER BY "id"');
            expect(restored).toEqual([{ id: 'existing', includeEventDetails: 0 }, { id: 'new', includeEventDetails: 0 }]);
            const columns = await db.getQueryInterface().describeTable('CalendarEventSnapshots');
            expect(columns.htmlLink.allowNull).toBe(true); expect(columns.location.allowNull).toBe(true); expect(columns.description.allowNull).toBe(true);
            await migration.down({ context });
            expect((await db.getQueryInterface().describeTable('CalendarEventSnapshots')).htmlLink).toBeUndefined();
        } finally { await db.close(); }
    });
});
