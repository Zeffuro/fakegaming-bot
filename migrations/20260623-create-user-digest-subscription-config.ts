interface MigrationSequelize {
    getDialect(): string;
    query(sql: string): Promise<unknown>;
}

async function createSqliteTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "UserDigestSubscriptionConfigs" (
            "id" VARCHAR(255) PRIMARY KEY,
            "discordId" VARCHAR(255) NOT NULL UNIQUE,
            "frequency" VARCHAR(16) NOT NULL,
            "timezone" VARCHAR(255) NOT NULL,
            "runAt" VARCHAR(5) NOT NULL,
            "dayOfWeek" INTEGER,
            "categories" TEXT NOT NULL DEFAULT '["reminders"]',
            "paused" BOOLEAN NOT NULL DEFAULT 0,
            "nextRunAt" BIGINT NOT NULL,
            "lastRunAt" BIGINT,
            "lastSentAt" BIGINT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function createPostgresTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "UserDigestSubscriptionConfigs" (
            "id" VARCHAR(255) PRIMARY KEY,
            "discordId" VARCHAR(255) NOT NULL UNIQUE,
            "frequency" VARCHAR(16) NOT NULL,
            "timezone" VARCHAR(255) NOT NULL,
            "runAt" VARCHAR(5) NOT NULL,
            "dayOfWeek" INTEGER,
            "categories" TEXT NOT NULL DEFAULT '["reminders"]',
            "paused" BOOLEAN NOT NULL DEFAULT FALSE,
            "nextRunAt" BIGINT NOT NULL,
            "lastRunAt" BIGINT,
            "lastSentAt" BIGINT,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

export const up = async ({ context }: { context: MigrationSequelize }) => {
    if (context.getDialect() === 'sqlite') {
        await createSqliteTable(context);
    } else {
        await createPostgresTable(context);
    }

    await context.query(`
        CREATE INDEX IF NOT EXISTS "idx_user_digest_subscription_next_run"
        ON "UserDigestSubscriptionConfigs" ("nextRunAt")
    `);
};

export const down = async ({ context }: { context: MigrationSequelize }) => {
    await context.query('DROP INDEX IF EXISTS "idx_user_digest_subscription_next_run"');
    await context.query('DROP TABLE IF EXISTS "UserDigestSubscriptionConfigs"');
};
