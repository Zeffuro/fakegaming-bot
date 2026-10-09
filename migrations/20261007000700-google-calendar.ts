interface MigrationContext { query(sql: string): Promise<unknown> }

export async function up({ context }: { context: MigrationContext }): Promise<void> {
    await context.query(`CREATE TABLE IF NOT EXISTS "CalendarConnections" (
        "userId" VARCHAR(32) PRIMARY KEY, "encryptedAccessToken" TEXT, "encryptedRefreshToken" TEXT,
        "expiresAt" BIGINT NOT NULL DEFAULT 0, "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
        "status" VARCHAR(16) NOT NULL DEFAULT 'disconnected' CHECK ("status" IN ('connected', 'disconnected')),
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "CalendarOAuthStates" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "encryptedVerifier" TEXT NOT NULL,
        "expiresAt" BIGINT NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "CalendarSources" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "calendarId" TEXT NOT NULL,
        "label" VARCHAR(250) NOT NULL, "timezone" VARCHAR(100) NOT NULL, "titleFilter" VARCHAR(200),
        "enabled" BOOLEAN NOT NULL DEFAULT true, "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
        "lastSyncedAt" BIGINT, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query('CREATE INDEX IF NOT EXISTS "ix_calendar_source_owner" ON "CalendarSources" ("userId")');
}

export async function down({ context }: { context: MigrationContext }): Promise<void> {
    for (const table of ['CalendarSources', 'CalendarOAuthStates', 'CalendarConnections']) {
        await context.query(`DROP TABLE IF EXISTS "${table}"`);
    }
}
