interface MigrationContext {
    query(sql: string): Promise<unknown>;
}

export async function up({ context }: { context: MigrationContext }): Promise<void> {
    await context.query('ALTER TABLE "UserTasks" ADD COLUMN "undoCompletionJson" TEXT');
}

export async function down({ context }: { context: MigrationContext }): Promise<void> {
    await context.query('ALTER TABLE "UserTasks" DROP COLUMN "undoCompletionJson"');
}
