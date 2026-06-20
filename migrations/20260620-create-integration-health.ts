interface MigrationSequelize {
    getDialect(): string;
    query(sql: string): Promise<unknown>;
}

async function createSqliteTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "IntegrationHealth" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "provider" VARCHAR(64) NOT NULL,
            "configId" VARCHAR(128) NOT NULL,
            "guildId" VARCHAR(255),
            "channelId" VARCHAR(255),
            "status" VARCHAR(16) NOT NULL DEFAULT 'unknown',
            "lastCheckedAt" DATETIME,
            "lastSuccessAt" DATETIME,
            "lastFailureAt" DATETIME,
            "lastDeliveryAt" DATETIME,
            "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
            "lastErrorCode" VARCHAR(64),
            "lastErrorMessage" TEXT,
            "metadata" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "unique_integration_health_provider_config" UNIQUE ("provider", "configId")
        )
    `);

    await createIndexes(context);
}

async function createPostgresTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "IntegrationHealth" (
            "id" SERIAL PRIMARY KEY,
            "provider" VARCHAR(64) NOT NULL,
            "configId" VARCHAR(128) NOT NULL,
            "guildId" VARCHAR(255),
            "channelId" VARCHAR(255),
            "status" VARCHAR(16) NOT NULL DEFAULT 'unknown',
            "lastCheckedAt" TIMESTAMP WITH TIME ZONE,
            "lastSuccessAt" TIMESTAMP WITH TIME ZONE,
            "lastFailureAt" TIMESTAMP WITH TIME ZONE,
            "lastDeliveryAt" TIMESTAMP WITH TIME ZONE,
            "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
            "lastErrorCode" VARCHAR(64),
            "lastErrorMessage" TEXT,
            "metadata" JSONB,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "unique_integration_health_provider_config" UNIQUE ("provider", "configId")
        )
    `);

    await createIndexes(context);
}

async function createIndexes(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE INDEX IF NOT EXISTS "ix_integrationhealth_provider"
        ON "IntegrationHealth" ("provider")
    `);

    await context.query(`
        CREATE INDEX IF NOT EXISTS "ix_integrationhealth_guild_provider"
        ON "IntegrationHealth" ("guildId", "provider")
    `);

    await context.query(`
        CREATE INDEX IF NOT EXISTS "ix_integrationhealth_status"
        ON "IntegrationHealth" ("status")
    `);
}

export const up = async ({ context }: { context: MigrationSequelize }) => {
    if (context.getDialect() === 'sqlite') {
        await createSqliteTable(context);
        return;
    }

    await createPostgresTable(context);
};

export const down = async ({ context }: { context: MigrationSequelize }) => {
    await context.query('DROP INDEX IF EXISTS "ix_integrationhealth_status"');
    await context.query('DROP INDEX IF EXISTS "ix_integrationhealth_guild_provider"');
    await context.query('DROP INDEX IF EXISTS "ix_integrationhealth_provider"');
    await context.query('DROP TABLE IF EXISTS "IntegrationHealth"');
};
