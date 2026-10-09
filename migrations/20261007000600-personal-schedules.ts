interface MigrationContext { query(sql: string): Promise<unknown> }

export async function up({ context }: { context: MigrationContext }): Promise<void> {
    await context.query(`CREATE TABLE IF NOT EXISTS "PersonalSchedules" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "sourceId" VARCHAR(64), "externalKey" VARCHAR(64),
        "title" VARCHAR(160) NOT NULL, "timezone" VARCHAR(100) NOT NULL, "anchorAt" BIGINT, "repeatWeeks" INTEGER,
        "enabled" BOOLEAN NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "ScheduleOccurrences" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "scheduleId" VARCHAR(64) NOT NULL,
        "externalKey" VARCHAR(64) NOT NULL, "eventId" VARCHAR(1024), "title" VARCHAR(160) NOT NULL, "timezone" VARCHAR(100) NOT NULL,
        "plannedAt" BIGINT NOT NULL, "endAt" BIGINT, "allDay" BOOLEAN NOT NULL, "cancelled" BOOLEAN NOT NULL,
        "state" VARCHAR(16) NOT NULL CHECK ("state" IN ('pending','completed')), "completedAt" BIGINT,
        "note" TEXT NOT NULL, "version" INTEGER NOT NULL, "nextNotifyAt" BIGINT, "notificationCount" INTEGER NOT NULL,
        "notificationEpoch" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "SchedulePreferences" (
        "userId" VARCHAR(32) PRIMARY KEY, "timezone" VARCHAR(100) NOT NULL, "quietStart" VARCHAR(5), "quietEnd" VARCHAR(5),
        "followupMinutes" INTEGER NOT NULL, "maxFollowups" INTEGER NOT NULL,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "ScheduleNotifications" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "occurrenceId" VARCHAR(64) NOT NULL,
        "attemptKey" VARCHAR(100) NOT NULL, "status" VARCHAR(16) NOT NULL CHECK ("status" IN ('sending','sent','rejected','uncertain')),
        "attemptedAt" BIGINT NOT NULL, "messageId" VARCHAR(32), "channelId" VARCHAR(32), "renderedVersion" INTEGER NOT NULL,
        "notificationEpoch" INTEGER NOT NULL, "scheduledAt" BIGINT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_personal_schedule_series" ON "PersonalSchedules" ("externalKey")');
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_schedule_occurrence_external" ON "ScheduleOccurrences" ("externalKey")');
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_schedule_notification_attempt" ON "ScheduleNotifications" ("attemptKey")');
    await context.query('CREATE INDEX IF NOT EXISTS "ix_schedule_occurrence_due" ON "ScheduleOccurrences" ("state","nextNotifyAt")');
    await context.query('CREATE INDEX IF NOT EXISTS "ix_schedule_occurrence_owner" ON "ScheduleOccurrences" ("userId","plannedAt")');
}

export async function down({ context }: { context: MigrationContext }): Promise<void> {
    for (const table of ['ScheduleNotifications', 'SchedulePreferences', 'ScheduleOccurrences', 'PersonalSchedules']) {
        await context.query(`DROP TABLE IF EXISTS "${table}"`);
    }
}
