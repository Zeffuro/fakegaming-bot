interface MigrationContext {
    query(sql: string): Promise<unknown>;
}

export const up = async ({ context }: { context: MigrationContext }) => {
    await context.query(`CREATE TABLE IF NOT EXISTS "PollSessions" (
        "id" VARCHAR(64) PRIMARY KEY,
        "guildId" VARCHAR(32) NOT NULL,
        "channelId" VARCHAR(32) NOT NULL,
        "messageId" VARCHAR(32) NOT NULL,
        "creatorId" VARCHAR(32) NOT NULL,
        "question" VARCHAR(200) NOT NULL,
        "optionsJson" TEXT NOT NULL,
        "votesJson" TEXT NOT NULL,
        "allowMultiple" BOOLEAN NOT NULL,
        "locale" VARCHAR(16) NOT NULL,
        "expiresAt" BIGINT NOT NULL,
        "closedAt" BIGINT,
        "closeReason" VARCHAR(16),
        "renderPending" BOOLEAN NOT NULL,
        "version" INTEGER NOT NULL,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL,
        CHECK ("closeReason" IS NULL OR "closeReason" IN ('creator', 'moderator', 'expired')),
        CHECK (("closedAt" IS NULL AND "closeReason" IS NULL) OR ("closedAt" IS NOT NULL AND "closeReason" IS NOT NULL))
    )`);
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_poll_message" ON "PollSessions" ("guildId", "channelId", "messageId")');
    await context.query('CREATE INDEX IF NOT EXISTS "ix_poll_expiry" ON "PollSessions" ("closedAt", "expiresAt")');
};

export const down = async ({ context }: { context: MigrationContext }) => {
    await context.query('DROP TABLE IF EXISTS "PollSessions"');
};
