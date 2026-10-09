interface MigrationContext { query(sql: string): Promise<unknown> }

export async function up({ context }: { context: MigrationContext }): Promise<void> {
    await context.query(`CREATE TABLE IF NOT EXISTS "CalendarEventSnapshotStates" (
        "sourceId" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "observedAt" BIGINT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "CalendarEventSnapshots" (
        "id" VARCHAR(64) PRIMARY KEY, "sourceId" VARCHAR(64) NOT NULL, "userId" VARCHAR(32) NOT NULL,
        "scheduleId" VARCHAR(64) NOT NULL, "eventId" VARCHAR(1024) NOT NULL, "title" VARCHAR(160) NOT NULL,
        "timezone" VARCHAR(100) NOT NULL, "plannedAt" BIGINT NOT NULL, "endAt" BIGINT,
        "allDay" BOOLEAN NOT NULL, "cancelled" BOOLEAN NOT NULL,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query('CREATE INDEX IF NOT EXISTS "ix_calendar_snapshot_source" ON "CalendarEventSnapshots" ("sourceId")');
    await context.query(`CREATE TABLE IF NOT EXISTS "CalendarPublications" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "sourceId" VARCHAR(64) NOT NULL,
        "guildId" VARCHAR(32) NOT NULL, "channelId" VARCHAR(32) NOT NULL,
        "guildName" VARCHAR(100) NOT NULL, "channelName" VARCHAR(100) NOT NULL,
        "lookaheadDays" INTEGER NOT NULL CHECK ("lookaheadDays" BETWEEN 30 AND 365),
        "eventLeadDays" INTEGER CHECK ("eventLeadDays" BETWEEN 1 AND 30), "publicTitle" VARCHAR(100),
        "enabled" BOOLEAN NOT NULL DEFAULT false, "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
        "lastError" VARCHAR(32), "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL,
        UNIQUE ("sourceId", "guildId", "channelId")
    )`);
    await context.query('CREATE INDEX IF NOT EXISTS "ix_calendar_publication_owner" ON "CalendarPublications" ("userId")');
    await context.query(`CREATE TABLE IF NOT EXISTS "CalendarPublicationDrafts" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "configuration" JSON NOT NULL,
        "snapshotHash" VARCHAR(64) NOT NULL, "previewAt" BIGINT NOT NULL, "expiresAt" BIGINT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "CalendarPublicationDeliveries" (
        "id" VARCHAR(64) PRIMARY KEY, "publicationId" VARCHAR(64) NOT NULL, "occurrenceId" VARCHAR(64) NOT NULL,
        "kind" VARCHAR(16) NOT NULL CHECK ("kind" IN ('message', 'event')),
        "status" VARCHAR(16) NOT NULL CHECK ("status" IN ('sending', 'sent', 'rejected', 'uncertain', 'missing')),
        "remoteId" VARCHAR(32), "renderedHash" VARCHAR(64), "attemptedAt" BIGINT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL,
        UNIQUE ("publicationId", "occurrenceId", "kind")
    )`);
    await context.query('CREATE INDEX IF NOT EXISTS "ix_calendar_publication_delivery" ON "CalendarPublicationDeliveries" ("publicationId")');
}

export async function down({ context }: { context: MigrationContext }): Promise<void> {
    for (const table of ['CalendarPublicationDeliveries', 'CalendarPublicationDrafts', 'CalendarPublications', 'CalendarEventSnapshots', 'CalendarEventSnapshotStates']) {
        await context.query(`DROP TABLE IF EXISTS "${table}"`);
    }
}
