import type { Sequelize } from 'sequelize';

export async function up({ context }: { context: Sequelize }): Promise<void> {
    await context.query(`CREATE TABLE "UserDashboardLayouts" (
        "userId" VARCHAR(32) PRIMARY KEY, "sectionsJson" TEXT NOT NULL,
        "schemaVersion" INTEGER NOT NULL DEFAULT 1 CHECK ("schemaVersion" = 1),
        "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version" >= 0),
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
}
export async function down({ context }: { context: Sequelize }): Promise<void> {
    await context.query('DROP TABLE "UserDashboardLayouts"');
}
