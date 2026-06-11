import type { Sequelize } from 'sequelize';

async function createSqliteTable(context: Sequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "BlueskyPostConfigs" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "blueskyHandle" VARCHAR(255) NOT NULL,
            "discordChannelId" VARCHAR(255) NOT NULL,
            "lastPostUri" VARCHAR(255),
            "lastPostCid" VARCHAR(255),
            "customMessage" TEXT,
            "cooldownMinutes" INTEGER,
            "quietHoursStart" VARCHAR(255),
            "quietHoursEnd" VARCHAR(255),
            "lastNotifiedAt" DATETIME,
            "guildId" VARCHAR(255) NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "unique_guild_bluesky_handle"
        ON "BlueskyPostConfigs" ("guildId", "blueskyHandle")
    `);
}

async function createPostgresTable(context: Sequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "BlueskyPostConfigs" (
            "id" SERIAL PRIMARY KEY,
            "blueskyHandle" VARCHAR(255) NOT NULL,
            "discordChannelId" VARCHAR(255) NOT NULL,
            "lastPostUri" VARCHAR(255),
            "lastPostCid" VARCHAR(255),
            "customMessage" TEXT,
            "cooldownMinutes" INTEGER,
            "quietHoursStart" VARCHAR(255),
            "quietHoursEnd" VARCHAR(255),
            "lastNotifiedAt" TIMESTAMP WITH TIME ZONE,
            "guildId" VARCHAR(255) NOT NULL,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "unique_guild_bluesky_handle"
        ON "BlueskyPostConfigs" ("guildId", "blueskyHandle")
    `);
}

export const up = async ({ context }: { context: Sequelize }) => {
    if (context.getDialect() === 'sqlite') {
        await createSqliteTable(context);
        return;
    }

    await createPostgresTable(context);
};

export const down = async ({ context }: { context: Sequelize }) => {
    await context.query('DROP INDEX IF EXISTS "unique_guild_bluesky_handle"');
    await context.query('DROP TABLE IF EXISTS "BlueskyPostConfigs"');
};
