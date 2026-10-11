interface MigrationContext {
    query(sql: string): Promise<unknown>;
}

export async function up({ context }: { context: MigrationContext }): Promise<void> {
    await context.query('ALTER TABLE "UserTasks" ADD COLUMN "sourceNoteId" VARCHAR(64)');
    await context.query('ALTER TABLE "UserTasks" ADD COLUMN "sourceUrl" VARCHAR(2048)');
    await context.query('CREATE UNIQUE INDEX "ux_user_task_source_note" ON "UserTasks" ("userId", "sourceNoteId")');
    await context.query('ALTER TABLE "UserNoteConfigs" ADD COLUMN "linkedTaskId" VARCHAR(64)');
}

export async function down({ context }: { context: MigrationContext }): Promise<void> {
    await context.query('ALTER TABLE "UserNoteConfigs" DROP COLUMN "linkedTaskId"');
    await context.query('DROP INDEX "ux_user_task_source_note"');
    await context.query('ALTER TABLE "UserTasks" DROP COLUMN "sourceUrl"');
    await context.query('ALTER TABLE "UserTasks" DROP COLUMN "sourceNoteId"');
}
