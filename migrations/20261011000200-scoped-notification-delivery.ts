import type { Sequelize, Transaction } from 'sequelize';

export async function up({ context }: { context: Sequelize }): Promise<void> {
    await context.transaction(async transaction => {
        if (context.getDialect() === 'sqlite') {
            await rebuildSqlite(context, transaction, true);
            return;
        }
        await context.query('ALTER TABLE "Notifications" ADD COLUMN "scopeKey" VARCHAR(255) NOT NULL DEFAULT \'\'', { transaction });
        await context.query('ALTER TABLE "Notifications" ADD COLUMN "deliveryStatus" VARCHAR(16) NOT NULL DEFAULT \'sent\' CHECK ("deliveryStatus" IN (\'sending\', \'sent\', \'uncertain\'))', { transaction });
        await context.query('UPDATE "Notifications" SET "scopeKey" = COALESCE("guildId", \'\')', { transaction });
        await context.query('ALTER TABLE "Notifications" DROP CONSTRAINT IF EXISTS "unique_provider_eventId"', { transaction });
        await context.query('DROP INDEX IF EXISTS "unique_provider_eventId"', { transaction });
        await context.query('ALTER TABLE "Notifications" ADD CONSTRAINT "unique_provider_event_scope" UNIQUE ("provider", "eventId", "scopeKey")', { transaction });
    });
}

export async function down({ context }: { context: Sequelize }): Promise<void> {
    await context.transaction(async transaction => {
        if (context.getDialect() === 'postgres') {
            await context.query('LOCK TABLE "Notifications" IN ACCESS EXCLUSIVE MODE', { transaction });
        }
        const [duplicates] = await context.query('SELECT "provider", "eventId" FROM "Notifications" GROUP BY "provider", "eventId" HAVING COUNT(*) > 1 LIMIT 1', { transaction });
        const [unsettled] = await context.query('SELECT "id" FROM "Notifications" WHERE "deliveryStatus" <> \'sent\' LIMIT 1', { transaction });
        if (duplicates.length || unsettled.length) {
            throw new Error('Cannot roll back scoped notifications while duplicate guild deliveries or unsettled receipts exist');
        }
        if (context.getDialect() === 'sqlite') {
            await rebuildSqlite(context, transaction, false);
            return;
        }
        await context.query('ALTER TABLE "Notifications" DROP CONSTRAINT "unique_provider_event_scope"', { transaction });
        await context.query('ALTER TABLE "Notifications" DROP COLUMN "scopeKey", DROP COLUMN "deliveryStatus"', { transaction });
        await context.query('ALTER TABLE "Notifications" ADD CONSTRAINT "unique_provider_eventId" UNIQUE ("provider", "eventId")', { transaction });
    });
}

async function rebuildSqlite(context: Sequelize, transaction: Transaction, scoped: boolean): Promise<void> {
    const query = (sql: string) => context.query(sql, { transaction });
    const [indexRows] = await query('SELECT "name", "sql" FROM sqlite_master WHERE "type" = \'index\' AND "tbl_name" = \'Notifications\' AND "sql" IS NOT NULL');
    const [indexList] = await query('PRAGMA index_list("Notifications")');
    const uniqueIndexes = new Set((indexList as { name: string; unique: number }[]).filter(index => index.unique).map(index => index.name));
    const indexes: string[] = [];
    for (const index of indexRows as { name: string; sql: string }[]) {
        const [columns] = await query(`PRAGMA index_info("${index.name.replace(/"/g, '""')}")`);
        const names = (columns as { name: string }[]).map(column => column.name);
        if (uniqueIndexes.has(index.name) && names.length >= 2 && names[0] === 'provider' && names[1] === 'eventId'
            && (names.length === 2 || (names.length === 3 && names[2] === 'scopeKey'))) continue;
        indexes.push(index.sql);
    }
    const [sequenceRows] = await query('SELECT "seq" FROM sqlite_sequence WHERE "name" = \'Notifications\'');
    const previousSequence = (sequenceRows as { seq: number }[])[0]?.seq ?? 0;
    const scopedColumns = scoped ? `,
        "scopeKey" VARCHAR(255) NOT NULL DEFAULT '',
        "deliveryStatus" VARCHAR(16) NOT NULL DEFAULT 'sent' CHECK ("deliveryStatus" IN ('sending','sent','uncertain'))` : '';
    const uniqueColumns = scoped ? '"provider", "eventId", "scopeKey"' : '"provider", "eventId"';
    const uniqueName = scoped ? 'unique_provider_event_scope' : 'unique_provider_eventId';
    await query(`CREATE TABLE "Notifications_rebuild" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT, "provider" VARCHAR(255) NOT NULL, "eventId" VARCHAR(255) NOT NULL,
        "guildId" VARCHAR(255), "channelId" VARCHAR(255), "messageId" VARCHAR(255),
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP${scopedColumns},
        CONSTRAINT "${uniqueName}" UNIQUE (${uniqueColumns})
    )`);
    const fields = '"id", "provider", "eventId", "guildId", "channelId", "messageId", "createdAt", "updatedAt"';
    await query(`INSERT INTO "Notifications_rebuild" (${fields}${scoped ? ', "scopeKey", "deliveryStatus"' : ''})
        SELECT ${fields}${scoped ? ', COALESCE("guildId", \'\'), \'sent\'' : ''} FROM "Notifications"`);
    await query('DROP TABLE "Notifications"');
    await query('ALTER TABLE "Notifications_rebuild" RENAME TO "Notifications"');
    if (previousSequence > 0) {
        await context.query('UPDATE sqlite_sequence SET "seq" = MAX("seq", :previous) WHERE "name" = \'Notifications\'', {
            transaction, replacements: { previous: previousSequence },
        });
    }
    for (const sql of indexes) await query(sql);
}
