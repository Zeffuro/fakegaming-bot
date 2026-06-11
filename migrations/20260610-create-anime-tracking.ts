import type { Sequelize } from 'sequelize';

async function createSqliteTables(context: Sequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "AnimeTitles" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "anilistId" INTEGER NOT NULL UNIQUE,
            "titleRomaji" VARCHAR(255),
            "titleEnglish" VARCHAR(255),
            "titleNative" VARCHAR(255),
            "description" TEXT,
            "siteUrl" VARCHAR(255),
            "coverImageUrl" VARCHAR(255),
            "bannerImageUrl" VARCHAR(255),
            "format" VARCHAR(255),
            "status" VARCHAR(255),
            "season" VARCHAR(255),
            "seasonYear" INTEGER,
            "episodes" INTEGER,
            "duration" INTEGER,
            "averageScore" INTEGER,
            "genresJson" TEXT,
            "nextEpisode" INTEGER,
            "nextAiringAt" BIGINT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE TABLE IF NOT EXISTS "AnimeSubscriptionConfigs" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "anilistId" INTEGER NOT NULL,
            "targetType" VARCHAR(255) NOT NULL,
            "userId" VARCHAR(255),
            "guildId" VARCHAR(255),
            "channelId" VARCHAR(255),
            "reminderMinutes" INTEGER NOT NULL DEFAULT 30,
            "lastNotifiedEpisode" INTEGER,
            "lastNotifiedAiringAt" BIGINT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE INDEX IF NOT EXISTS "idx_anime_subscriptions_lookup"
        ON "AnimeSubscriptionConfigs" ("anilistId", "targetType", "userId", "guildId", "channelId")
    `);

    await context.query(`
        CREATE TABLE IF NOT EXISTS "AnimeEpisodes" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "anilistId" INTEGER NOT NULL,
            "episode" INTEGER NOT NULL,
            "airingAt" BIGINT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "unique_anime_episode"
        ON "AnimeEpisodes" ("anilistId", "episode")
    `);
}

async function createPostgresTables(context: Sequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "AnimeTitles" (
            "id" SERIAL PRIMARY KEY,
            "anilistId" INTEGER NOT NULL UNIQUE,
            "titleRomaji" VARCHAR(255),
            "titleEnglish" VARCHAR(255),
            "titleNative" VARCHAR(255),
            "description" TEXT,
            "siteUrl" VARCHAR(255),
            "coverImageUrl" VARCHAR(255),
            "bannerImageUrl" VARCHAR(255),
            "format" VARCHAR(255),
            "status" VARCHAR(255),
            "season" VARCHAR(255),
            "seasonYear" INTEGER,
            "episodes" INTEGER,
            "duration" INTEGER,
            "averageScore" INTEGER,
            "genresJson" TEXT,
            "nextEpisode" INTEGER,
            "nextAiringAt" BIGINT,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE TABLE IF NOT EXISTS "AnimeSubscriptionConfigs" (
            "id" SERIAL PRIMARY KEY,
            "anilistId" INTEGER NOT NULL,
            "targetType" VARCHAR(255) NOT NULL,
            "userId" VARCHAR(255),
            "guildId" VARCHAR(255),
            "channelId" VARCHAR(255),
            "reminderMinutes" INTEGER NOT NULL DEFAULT 30,
            "lastNotifiedEpisode" INTEGER,
            "lastNotifiedAiringAt" BIGINT,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE INDEX IF NOT EXISTS "idx_anime_subscriptions_lookup"
        ON "AnimeSubscriptionConfigs" ("anilistId", "targetType", "userId", "guildId", "channelId")
    `);

    await context.query(`
        CREATE TABLE IF NOT EXISTS "AnimeEpisodes" (
            "id" SERIAL PRIMARY KEY,
            "anilistId" INTEGER NOT NULL,
            "episode" INTEGER NOT NULL,
            "airingAt" BIGINT NOT NULL,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "unique_anime_episode"
        ON "AnimeEpisodes" ("anilistId", "episode")
    `);
}

export const up = async ({ context }: { context: Sequelize }) => {
    if (context.getDialect() === 'sqlite') {
        await createSqliteTables(context);
        return;
    }

    await createPostgresTables(context);
};

export const down = async ({ context }: { context: Sequelize }) => {
    await context.query('DROP INDEX IF EXISTS "unique_anime_episode"');
    await context.query('DROP TABLE IF EXISTS "AnimeEpisodes"');
    await context.query('DROP INDEX IF EXISTS "idx_anime_subscriptions_lookup"');
    await context.query('DROP TABLE IF EXISTS "AnimeSubscriptionConfigs"');
    await context.query('DROP TABLE IF EXISTS "AnimeTitles"');
};
