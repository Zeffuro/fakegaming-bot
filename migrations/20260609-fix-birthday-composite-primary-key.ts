import { Sequelize } from 'sequelize';

const tableName = 'BirthdayConfigs';
const columns = '"userId", "day", "month", "year", "guildId", "channelId", "createdAt", "updatedAt"';

async function rebuildSqliteTable(context: Sequelize, primaryKey: string): Promise<void> {
    await context.query('PRAGMA foreign_keys=OFF');
    await context.query('DROP INDEX IF EXISTS unique_user_guild_birthday');
    await context.query(`
        CREATE TABLE "BirthdayConfigs_new" (
            "userId" VARCHAR(255) NOT NULL,
            "day" INTEGER NOT NULL,
            "month" INTEGER NOT NULL,
            "year" INTEGER,
            "guildId" VARCHAR(255) NOT NULL,
            "channelId" VARCHAR(255) NOT NULL,
            "createdAt" DATETIME NOT NULL,
            "updatedAt" DATETIME NOT NULL,
            PRIMARY KEY (${primaryKey})
        )
    `);
    await context.query(`INSERT INTO "BirthdayConfigs_new" (${columns}) SELECT ${columns} FROM "BirthdayConfigs"`);
    await context.query('DROP TABLE "BirthdayConfigs"');
    await context.query('ALTER TABLE "BirthdayConfigs_new" RENAME TO "BirthdayConfigs"');
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS unique_user_guild_birthday ON "BirthdayConfigs" ("userId", "guildId")');
    await context.query('PRAGMA foreign_keys=ON');
}

export const up = async ({ context }: { context: Sequelize }) => {
    const dialect = context.getDialect();

    if (dialect === 'sqlite') {
        await rebuildSqliteTable(context, '"userId", "guildId"');
        return;
    }

    const qi = context.getQueryInterface();
    await qi.sequelize.transaction(async (transaction) => {
        await context.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "BirthdayConfigs_pkey"`, { transaction });
        await context.query(`ALTER TABLE "${tableName}" ADD CONSTRAINT "BirthdayConfigs_pkey" PRIMARY KEY ("userId", "guildId")`, { transaction });
        await context.query(`CREATE UNIQUE INDEX IF NOT EXISTS unique_user_guild_birthday ON "${tableName}" ("userId", "guildId")`, { transaction });
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const dialect = context.getDialect();

    if (dialect === 'sqlite') {
        await rebuildSqliteTable(context, '"userId"');
        return;
    }

    const qi = context.getQueryInterface();
    await qi.sequelize.transaction(async (transaction) => {
        await context.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "BirthdayConfigs_pkey"`, { transaction });
        await context.query(`ALTER TABLE "${tableName}" ADD CONSTRAINT "BirthdayConfigs_pkey" PRIMARY KEY ("userId")`, { transaction });
    });
};
