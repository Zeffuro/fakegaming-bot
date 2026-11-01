interface MigrationContext { query(sql: string): Promise<unknown> }

export async function up({ context }: { context: MigrationContext }): Promise<void> {
    await context.query(`CREATE TABLE IF NOT EXISTS "SubmissionCategories" (
        "id" VARCHAR(64) PRIMARY KEY, "guildId" VARCHAR(32) NOT NULL, "name" VARCHAR(80) NOT NULL,
        "destinationChannelId" VARCHAR(32) NOT NULL, "reviewChannelId" VARCHAR(32) NOT NULL,
        "reviewerRoleIdsJson" TEXT NOT NULL, "submitterRoleIdsJson" TEXT NOT NULL,
        "enabled" BOOLEAN NOT NULL, "version" INTEGER NOT NULL,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL,
        CHECK ("destinationChannelId" <> "reviewChannelId"), CHECK ("version" >= 0)
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "SubmissionRecords" (
        "id" VARCHAR(64) PRIMARY KEY, "guildId" VARCHAR(32) NOT NULL, "categoryId" VARCHAR(64) NOT NULL,
        "categoryName" VARCHAR(80) NOT NULL, "destinationChannelId" VARCHAR(32) NOT NULL,
        "userId" VARCHAR(32) NOT NULL, "explanation" TEXT NOT NULL, "link" TEXT, "credit" VARCHAR(100),
        "attachmentCount" INTEGER NOT NULL, "status" VARCHAR(32) NOT NULL, "version" INTEGER NOT NULL,
        "reviewChannelId" VARCHAR(32) NOT NULL, "reviewMessageId" VARCHAR(32), "attachmentsJson" TEXT NOT NULL,
        "reviewerId" VARCHAR(32), "reason" TEXT, "publishedChannelId" VARCHAR(32), "publishedMessageId" VARCHAR(32),
        "createdAt" BIGINT NOT NULL, "updatedAt" BIGINT NOT NULL,
        CHECK ("status" IN ('uploading','pending','changes_requested','publishing','published','rejected','upload_failed','publish_failed','uncertain')),
        CHECK ("version" >= 0), CHECK ("attachmentCount" BETWEEN 0 AND 4)
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "SubmissionLocks" (
        "key" VARCHAR(128) PRIMARY KEY, "lastSubmittedAt" BIGINT
    )`);
    await context.query(`CREATE TABLE IF NOT EXISTS "SubmissionPanels" (
        "guildId" VARCHAR(32) PRIMARY KEY, "channelId" VARCHAR(32) NOT NULL, "messageId" VARCHAR(32) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL
    )`);
    await context.query('CREATE INDEX IF NOT EXISTS "ix_submission_categories_guild" ON "SubmissionCategories" ("guildId", "enabled")');
    await context.query('CREATE INDEX IF NOT EXISTS "ix_submission_owner" ON "SubmissionRecords" ("guildId", "userId", "status", "createdAt")');
    await context.query('CREATE INDEX IF NOT EXISTS "ix_submission_status" ON "SubmissionRecords" ("status")');
}

export async function down({ context }: { context: MigrationContext }): Promise<void> {
    for (const table of ['SubmissionRecords', 'SubmissionCategories', 'SubmissionPanels', 'SubmissionLocks']) {
        await context.query(`DROP TABLE IF EXISTS "${table}"`);
    }
}
