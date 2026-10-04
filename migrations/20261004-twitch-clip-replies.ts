interface MigrationDatabase {
    query(sql: string): Promise<unknown>;
}

export const up = async ({ context }: { context: MigrationDatabase }) => {
    await context.query('ALTER TABLE "TwitchClipConfigs" ADD COLUMN "replyEnabled" BOOLEAN NOT NULL DEFAULT true');
    await context.query('ALTER TABLE "TwitchClipConfigs" ADD COLUMN "replyTemplate" TEXT');
    await context.query('ALTER TABLE "TwitchClipRequests" ADD COLUMN "replyAttemptedAt" TIMESTAMP');
    await context.query('ALTER TABLE "TwitchClipBotAuths" ADD COLUMN "scopes" JSON NOT NULL DEFAULT \'[]\'');
};

export const down = async ({ context }: { context: MigrationDatabase }) => {
    await context.query('ALTER TABLE "TwitchClipBotAuths" DROP COLUMN "scopes"');
    await context.query('ALTER TABLE "TwitchClipRequests" DROP COLUMN "replyAttemptedAt"');
    await context.query('ALTER TABLE "TwitchClipConfigs" DROP COLUMN "replyTemplate"');
    await context.query('ALTER TABLE "TwitchClipConfigs" DROP COLUMN "replyEnabled"');
};
