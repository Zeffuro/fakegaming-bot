interface MigrationDatabase {
    query(sql: string): Promise<unknown>;
}

export const up = async ({ context }: { context: MigrationDatabase }) => {
    await context.query(`CREATE TABLE IF NOT EXISTS "TwitchClipConfigs" (
        "id" VARCHAR(255) PRIMARY KEY, "guildId" VARCHAR(255) NOT NULL,
        "twitchUsername" VARCHAR(255) NOT NULL, "broadcasterId" VARCHAR(255) NOT NULL,
        "discordChannelId" VARCHAR(255) NOT NULL, "command" VARCHAR(255) NOT NULL DEFAULT '!clip',
        "aliases" JSON NOT NULL DEFAULT '[]', "permission" VARCHAR(255) NOT NULL DEFAULT 'everyone'
            CHECK ("permission" IN ('everyone', 'subscribers', 'moderators', 'owner')),
        "cooldownSeconds" INTEGER NOT NULL DEFAULT 30 CHECK ("cooldownSeconds" BETWEEN 15 AND 3600),
        "durationSeconds" INTEGER NOT NULL DEFAULT 30 CHECK ("durationSeconds" BETWEEN 5 AND 60),
        "enabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL,
        CONSTRAINT "unique_guild_twitch_clip_username" UNIQUE ("guildId", "twitchUsername")
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "TwitchClipRequests" (
        "id" VARCHAR(255) PRIMARY KEY, "broadcasterId" VARCHAR(255) NOT NULL,
        "status" VARCHAR(255) NOT NULL CHECK ("status" IN ('creating', 'ready', 'failed', 'delivered')),
        "clipId" VARCHAR(255), "targetsJson" TEXT NOT NULL, "triggerName" VARCHAR(255) NOT NULL,
        "requestedAt" TIMESTAMP NOT NULL, "errorCode" VARCHAR(255),
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "TwitchClipCooldowns" (
        "broadcasterId" VARCHAR(255) PRIMARY KEY, "availableAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "TwitchClipBotAuths" (
        "id" VARCHAR(255) PRIMARY KEY, "userId" VARCHAR(255) NOT NULL, "login" VARCHAR(255) NOT NULL,
        "encryptedAccessToken" TEXT NOT NULL, "encryptedRefreshToken" TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "TwitchClipOAuthStates" (
        "id" VARCHAR(255) PRIMARY KEY, "actorId" VARCHAR(255) NOT NULL, "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query('CREATE INDEX IF NOT EXISTS "twitch_clip_pending_requests" ON "TwitchClipRequests" ("status", "requestedAt")');
};

export const down = async ({ context }: { context: MigrationDatabase }) => {
    for (const table of ['TwitchClipOAuthStates', 'TwitchClipBotAuths', 'TwitchClipCooldowns', 'TwitchClipRequests', 'TwitchClipConfigs']) {
        await context.query(`DROP TABLE IF EXISTS "${table}"`);
    }
};
