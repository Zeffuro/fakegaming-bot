interface MigrationContext { query(sql: string): Promise<unknown> }

export async function up({ context }: { context: MigrationContext }): Promise<void> {
    await context.query('ALTER TABLE "PollSessions" ADD COLUMN "hideResults" BOOLEAN NOT NULL DEFAULT false');
}

export async function down({ context }: { context: MigrationContext }): Promise<void> {
    await context.query('ALTER TABLE "PollSessions" DROP COLUMN "hideResults"');
}
