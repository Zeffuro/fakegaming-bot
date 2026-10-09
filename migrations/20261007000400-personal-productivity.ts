interface MigrationContext {
    query(sql: string): Promise<unknown>;
}

export async function up({ context }: { context: MigrationContext }): Promise<void> {
    await context.query(`CREATE TABLE IF NOT EXISTS "UserTasks" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "title" VARCHAR(120) NOT NULL,
        "checklistJson" TEXT NOT NULL, "state" VARCHAR(16) NOT NULL, "dueAt" BIGINT,
        "recurrenceUnit" VARCHAR(16), "recurrenceInterval" INTEGER, "timezone" VARCHAR(100) NOT NULL,
        "reminderId" VARCHAR(64), "completedAt" BIGINT, "version" INTEGER NOT NULL, "completions" INTEGER NOT NULL,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL,
        CHECK ("state" IN ('active', 'completed'))
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "UserSessions" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "title" VARCHAR(120) NOT NULL,
        "kind" VARCHAR(16) NOT NULL, "state" VARCHAR(16) NOT NULL, "activeKey" VARCHAR(32),
        "startedAt" BIGINT NOT NULL, "runningSince" BIGINT, "endedAt" BIGINT,
        "workMs" BIGINT NOT NULL, "breakElapsedMs" BIGINT NOT NULL, "phaseElapsedMs" BIGINT NOT NULL,
        "durationMs" BIGINT, "pomodoro" BOOLEAN NOT NULL, "phase" VARCHAR(16) NOT NULL,
        "breakMs" BIGINT NOT NULL, "cycles" INTEGER NOT NULL, "cycleIndex" INTEGER NOT NULL,
        "breakEveryMs" BIGINT, "nextBreakMs" BIGINT, "reminderId" VARCHAR(64), "messagesJson" TEXT NOT NULL,
        "version" INTEGER NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL,
        CHECK ("kind" IN ('focus', 'gaming')), CHECK ("state" IN ('running', 'paused', 'stopped', 'finished')),
        CHECK ("phase" IN ('focus', 'break')), CHECK ("workMs" >= 0 AND "breakElapsedMs" >= 0 AND "phaseElapsedMs" >= 0)
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "UserCountdowns" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "title" VARCHAR(120) NOT NULL,
        "dueAt" BIGINT NOT NULL, "timezone" VARCHAR(100) NOT NULL, "advanceMinutes" INTEGER, "reminderIdsJson" TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query('CREATE INDEX IF NOT EXISTS "ix_user_tasks_owner" ON "UserTasks" ("userId", "state", "dueAt")');
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_user_session_active" ON "UserSessions" ("activeKey")');
    await context.query('CREATE INDEX IF NOT EXISTS "ix_user_sessions_owner" ON "UserSessions" ("userId", "endedAt")');
    await context.query('CREATE INDEX IF NOT EXISTS "ix_user_countdowns_owner" ON "UserCountdowns" ("userId", "dueAt")');
}

export async function down({ context }: { context: MigrationContext }): Promise<void> {
    await context.query('DROP TABLE IF EXISTS "UserCountdowns"');
    await context.query('DROP TABLE IF EXISTS "UserSessions"');
    await context.query('DROP TABLE IF EXISTS "UserTasks"');
}
