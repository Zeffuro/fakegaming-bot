import { describe, expect, it } from 'vitest';
import { Sequelize } from 'sequelize';

interface Migration {
    up(options: { context: Sequelize }): Promise<void>;
    down(options: { context: Sequelize }): Promise<void>;
}

describe('submission raw SQL migration', () => {
    it('applies idempotently, enforces status/count/routing constraints, and reverses on SQLite', async () => {
        const migration = await import(new URL('../../../../migrations/20261101000100-submissions.ts', import.meta.url).href) as Migration;
        const context = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        try {
            await migration.up({ context });
            await migration.up({ context });
            const tables = await context.getQueryInterface().showAllTables();
            expect(tables).toEqual(expect.arrayContaining(['SubmissionCategories', 'SubmissionRecords', 'SubmissionLocks', 'SubmissionPanels']));
            await expect(context.query(`INSERT INTO "SubmissionCategories"
                ("id","guildId","name","destinationChannelId","reviewChannelId","reviewerRoleIdsJson","submitterRoleIdsJson","enabled","version","createdAt","updatedAt")
                VALUES ('test','1','Name','2','2','[]','[]',true,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)).rejects.toThrow();
            const values = `('test','1','category','Name','2','10','Explanation',0,'pending',0,'3','[]',1,1)`;
            const insert = `INSERT INTO "SubmissionRecords" ("id","guildId","categoryId","categoryName","destinationChannelId","userId","explanation","attachmentCount","status","version","reviewChannelId","attachmentsJson","createdAt","updatedAt") VALUES `;
            await context.query(insert + values);
            await expect(context.query(`UPDATE "SubmissionRecords" SET "status" = 'approved'`)).rejects.toThrow();
            await expect(context.query(`UPDATE "SubmissionRecords" SET "attachmentCount" = 5`)).rejects.toThrow();
            await expect(context.query(`UPDATE "SubmissionRecords" SET "version" = -1`)).rejects.toThrow();
            await migration.down({ context });
            await migration.down({ context });
            expect(await context.getQueryInterface().showAllTables()).toEqual([]);
        } finally { await context.close(); }
    });
});
