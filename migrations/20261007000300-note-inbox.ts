interface MigrationContext {
    getDialect(): string;
    query(sql: string): Promise<unknown>;
}

export async function up({ context }: { context: MigrationContext }): Promise<void> {
    await context.query(`ALTER TABLE "UserNoteConfigs" ADD COLUMN "status" VARCHAR(16) NOT NULL DEFAULT 'unread' CHECK ("status" IN ('unread', 'read', 'archived'))`);
    const tagsType = context.getDialect() === 'sqlite' ? 'TEXT' : 'JSON';
    await context.query(`ALTER TABLE "UserNoteConfigs" ADD COLUMN "tags" ${tagsType} NOT NULL DEFAULT '[]'`);
    await context.query('ALTER TABLE "UserNoteConfigs" ADD COLUMN "sourceUrl" VARCHAR(2048)');
    await context.query('CREATE INDEX "idx_user_notes_inbox" ON "UserNoteConfigs" ("discordId", "status", "updatedAt")');
}

export async function down({ context }: { context: MigrationContext }): Promise<void> {
    await context.query('DROP INDEX IF EXISTS "idx_user_notes_inbox"');
    await context.query('ALTER TABLE "UserNoteConfigs" DROP COLUMN "sourceUrl"');
    await context.query('ALTER TABLE "UserNoteConfigs" DROP COLUMN "tags"');
    await context.query('ALTER TABLE "UserNoteConfigs" DROP COLUMN "status"');
}
