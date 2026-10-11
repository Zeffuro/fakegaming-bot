import type { Sequelize } from 'sequelize';

export async function up({ context }: { context: Sequelize }): Promise<void> {
    await context.query(`CREATE TABLE "UserChecklistTemplates" (
        "id" VARCHAR(64) PRIMARY KEY, "userId" VARCHAR(32) NOT NULL,
        "title" VARCHAR(120) NOT NULL, "itemsJson" TEXT NOT NULL,
        "version" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query('CREATE INDEX "ix_checklist_template_owner" ON "UserChecklistTemplates" ("userId")');
}

export async function down({ context }: { context: Sequelize }): Promise<void> {
    await context.query('DROP TABLE "UserChecklistTemplates"');
}
