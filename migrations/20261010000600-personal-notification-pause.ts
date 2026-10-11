import type { Sequelize } from 'sequelize';
export async function up({ context }: { context: Sequelize }): Promise<void> {
    await context.query(`CREATE TABLE "PersonalNotificationPauses" (
        "userId" VARCHAR(32) PRIMARY KEY, "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
        "resumeAt" BIGINT NULL, "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version" >= 0),
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
}
export async function down({ context }: { context: Sequelize }): Promise<void> {
    await context.query('DROP TABLE "PersonalNotificationPauses"');
}
