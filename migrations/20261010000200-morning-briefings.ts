import type { Sequelize } from 'sequelize';

export async function up({ context }: { context: Sequelize }): Promise<void> {
    await context.query(`CREATE TABLE "MorningBriefingSettings" (
        "userId" VARCHAR(32) PRIMARY KEY, "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
        "localTime" VARCHAR(5) NOT NULL DEFAULT '09:00', "version" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query(`CREATE TABLE "MorningBriefingDeliveries" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL, "localDate" VARCHAR(10) NOT NULL,
        "timezone" VARCHAR(100) NOT NULL, "settingsVersion" INTEGER NOT NULL,
        "status" VARCHAR(16) NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 1,
        "claimToken" VARCHAR(64) NOT NULL, "attemptedAt" BIGINT NOT NULL, "retryAt" BIGINT,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query('CREATE UNIQUE INDEX "ux_morning_briefing_day" ON "MorningBriefingDeliveries" ("userId", "localDate")');
}

export async function down({ context }: { context: Sequelize }): Promise<void> {
    await context.query('DROP TABLE "MorningBriefingDeliveries"');
    await context.query('DROP TABLE "MorningBriefingSettings"');
}
