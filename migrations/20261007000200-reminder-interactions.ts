interface MigrationContext {
    query(sql: string): Promise<unknown>;
}

export async function up({ context }: { context: MigrationContext }): Promise<void> {
    await context.query(`CREATE TABLE IF NOT EXISTS "ReminderDrafts" (
        "id" VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(32) NOT NULL,
        "message" TEXT NOT NULL,
        "expiresAt" BIGINT NOT NULL,
        "consumed" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "ReminderDeliveries" (
        "id" VARCHAR(64) PRIMARY KEY,
        "reminderId" VARCHAR(64) NOT NULL,
        "scheduledAt" BIGINT NOT NULL,
        "sourceTimestamp" BIGINT NOT NULL,
        "userId" VARCHAR(32) NOT NULL,
        "message" TEXT NOT NULL,
        "status" VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'sending', 'uncertain', 'delivered', 'snoozed', 'dismissed')),
        "attemptedAt" BIGINT,
        "finalized" BOOLEAN NOT NULL DEFAULT false,
        "messageId" VARCHAR(32),
        "channelId" VARCHAR(32),
        "expiresAt" BIGINT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query('CREATE INDEX IF NOT EXISTS "ix_reminder_draft_expiry" ON "ReminderDrafts" ("expiresAt")');
    await context.query('CREATE INDEX IF NOT EXISTS "ix_reminder_delivery_expiry" ON "ReminderDeliveries" ("expiresAt")');
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_reminder_delivery_occurrence" ON "ReminderDeliveries" ("reminderId", "scheduledAt")');
}

export async function down({ context }: { context: MigrationContext }): Promise<void> {
    await context.query('DROP TABLE IF EXISTS "ReminderDeliveries"');
    await context.query('DROP TABLE IF EXISTS "ReminderDrafts"');
}
