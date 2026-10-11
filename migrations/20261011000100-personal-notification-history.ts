import type { Sequelize } from 'sequelize';

export async function up({ context }: { context: Sequelize }): Promise<void> {
    await context.query(`CREATE TABLE "PersonalNotificationHistory" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL,
        "kind" VARCHAR(16) NOT NULL CHECK ("kind" IN ('reminder','follow','schedule','briefing','digest','anime')),
        "occurrenceKey" VARCHAR(256) NOT NULL, "title" VARCHAR(200) NOT NULL,
        "status" VARCHAR(16) NOT NULL CHECK ("status" IN ('pending','sent','delayed','skipped','failed','uncertain')),
        "reason" VARCHAR(16) NULL CHECK ("reason" IN ('paused','quietHours','digestTime','retry','empty','ineligible','unknown','interrupted')),
        "scheduledAt" BIGINT NOT NULL CHECK ("scheduledAt" >= 0), "updatedAt" BIGINT NOT NULL CHECK ("updatedAt" >= 0),
        "sentAt" BIGINT NULL CHECK ("sentAt" >= 0), "messageId" VARCHAR(32) NULL, "channelId" VARCHAR(32) NULL,
        CHECK (length("userId") BETWEEN 1 AND 32), CHECK (length("occurrenceKey") BETWEEN 1 AND 256), CHECK (length("title") <= 200)
    )`);
    await context.query('CREATE UNIQUE INDEX "ux_personal_notification_occurrence" ON "PersonalNotificationHistory" ("userId", "kind", "occurrenceKey")');
    await context.query('CREATE INDEX "ix_personal_notification_owner_updated" ON "PersonalNotificationHistory" ("userId", "updatedAt", "id")');
    await context.query('CREATE INDEX "ix_personal_notification_retention" ON "PersonalNotificationHistory" ("updatedAt")');
}

export async function down({ context }: { context: Sequelize }): Promise<void> {
    await context.query('DROP TABLE "PersonalNotificationHistory"');
}
