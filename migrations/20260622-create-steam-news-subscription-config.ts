interface MigrationSequelize {
    getDialect(): string;
    query(sql: string): Promise<unknown>;
}

async function createSqliteTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "SteamNewsSubscriptionConfigs" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "steamAppId" INTEGER NOT NULL,
            "appName" VARCHAR(255),
            "discordChannelId" VARCHAR(255) NOT NULL,
            "guildId" VARCHAR(255) NOT NULL,
            "lastNewsGid" VARCHAR(255),
            "lastAnnouncedAt" BIGINT,
            "customMessage" TEXT,
            "cooldownMinutes" INTEGER,
            "quietHoursStart" VARCHAR(255),
            "quietHoursEnd" VARCHAR(255),
            "paused" BOOLEAN NOT NULL DEFAULT 0,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "unique_guild_steam_app_channel"
        ON "SteamNewsSubscriptionConfigs" ("guildId", "steamAppId", "discordChannelId")
    `);
}

async function createPostgresTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "SteamNewsSubscriptionConfigs" (
            "id" SERIAL PRIMARY KEY,
            "steamAppId" INTEGER NOT NULL,
            "appName" VARCHAR(255),
            "discordChannelId" VARCHAR(255) NOT NULL,
            "guildId" VARCHAR(255) NOT NULL,
            "lastNewsGid" VARCHAR(255),
            "lastAnnouncedAt" BIGINT,
            "customMessage" TEXT,
            "cooldownMinutes" INTEGER,
            "quietHoursStart" VARCHAR(255),
            "quietHoursEnd" VARCHAR(255),
            "paused" BOOLEAN NOT NULL DEFAULT FALSE,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "unique_guild_steam_app_channel"
        ON "SteamNewsSubscriptionConfigs" ("guildId", "steamAppId", "discordChannelId")
    `);
}

export const up = async ({ context }: { context: MigrationSequelize }) => {
    if (context.getDialect() === 'sqlite') {
        await createSqliteTable(context);
        return;
    }

    await createPostgresTable(context);
};

export const down = async ({ context }: { context: MigrationSequelize }) => {
    await context.query('DROP INDEX IF EXISTS "unique_guild_steam_app_channel"');
    await context.query('DROP TABLE IF EXISTS "SteamNewsSubscriptionConfigs"');
};
