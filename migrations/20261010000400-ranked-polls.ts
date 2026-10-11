import type { Sequelize } from 'sequelize';

export async function up({ context }: { context: Sequelize }): Promise<void> {
    for (const table of ['PollSessions', 'PollTemplates']) {
        await context.query(`ALTER TABLE "${table}" ADD COLUMN "ranked" BOOLEAN NOT NULL DEFAULT FALSE CHECK (NOT ("ranked" AND "allowMultiple"))`);
    }
}
export async function down({ context }: { context: Sequelize }): Promise<void> {
    for (const table of ['PollTemplates', 'PollSessions']) await context.query(`ALTER TABLE "${table}" DROP COLUMN "ranked"`);
}
