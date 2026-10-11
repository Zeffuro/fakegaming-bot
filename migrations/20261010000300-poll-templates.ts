import type { Sequelize } from 'sequelize';

export async function up({ context }: { context: Sequelize }): Promise<void> {
    await context.query('ALTER TABLE "PollSessions" ADD COLUMN "durationMinutes" INTEGER NULL CHECK ("durationMinutes" BETWEEN 1 AND 1440)');
    await context.query(`CREATE TABLE "PollTemplates" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL,
        "title" VARCHAR(120) NOT NULL, "question" VARCHAR(200) NOT NULL, "optionsJson" TEXT NOT NULL,
        "durationMinutes" INTEGER NOT NULL CHECK ("durationMinutes" BETWEEN 1 AND 1440),
        "allowMultiple" BOOLEAN NOT NULL DEFAULT FALSE, "hideResults" BOOLEAN NOT NULL DEFAULT FALSE,
        "version" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query('CREATE INDEX "ix_poll_template_owner" ON "PollTemplates" ("userId")');
}
export async function down({ context }: { context: Sequelize }): Promise<void> {
    await context.query('DROP TABLE "PollTemplates"');
    await context.query('ALTER TABLE "PollSessions" DROP COLUMN "durationMinutes"');
}
