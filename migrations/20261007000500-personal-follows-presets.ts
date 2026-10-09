interface MigrationContext { query(sql: string): Promise<unknown> }

export async function up({ context }: { context: MigrationContext }): Promise<void> {
    await context.query(`CREATE TABLE IF NOT EXISTS "UserFollows" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "provider" VARCHAR(16) NOT NULL CHECK ("provider" IN ('twitch', 'steam')),
        "target" VARCHAR(64) NOT NULL, "label" VARCHAR(200) NOT NULL, "mode" VARCHAR(16) NOT NULL DEFAULT 'immediate' CHECK ("mode" IN ('immediate', 'digest')),
        "paused" BOOLEAN NOT NULL DEFAULT false, "cursor" VARCHAR(128), "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_user_follow" ON "UserFollows" ("userId", "provider", "target")');
    await context.query(`CREATE TABLE IF NOT EXISTS "UserFollowSettings" (
        "userId" VARCHAR(32) PRIMARY KEY, "timezone" VARCHAR(100) NOT NULL DEFAULT 'UTC', "quietStart" VARCHAR(5), "quietEnd" VARCHAR(5),
        "digestAt" VARCHAR(5) NOT NULL DEFAULT '09:00', "lastDigestDate" VARCHAR(10), "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "UserFollowEvents" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "followId" VARCHAR(64) NOT NULL, "eventKey" VARCHAR(128) NOT NULL,
        "title" TEXT NOT NULL, "url" TEXT NOT NULL, "mode" VARCHAR(16) NOT NULL CHECK ("mode" IN ('immediate', 'digest')),
        "status" VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'sending', 'sent', 'uncertain')),
        "attemptedAt" BIGINT, "occurredAt" BIGINT NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_user_follow_event" ON "UserFollowEvents" ("followId", "eventKey")');
    await context.query('CREATE INDEX IF NOT EXISTS "ix_user_follow_pending" ON "UserFollowEvents" ("userId", "status", "mode")');
    await context.query(`CREATE TABLE IF NOT EXISTS "UserCommandPresets" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "name" VARCHAR(40) NOT NULL, "commandPath" VARCHAR(100) NOT NULL,
        "argumentsJson" TEXT NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_user_command_preset" ON "UserCommandPresets" ("userId", "name")');
}

export async function down({ context }: { context: MigrationContext }): Promise<void> {
    for (const table of ['UserCommandPresets', 'UserFollowEvents', 'UserFollowSettings', 'UserFollows']) {
        await context.query(`DROP TABLE IF EXISTS "${table}"`);
    }
}
