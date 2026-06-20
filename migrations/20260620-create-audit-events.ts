interface MigrationSequelize {
    getDialect(): string;
    query(sql: string): Promise<unknown>;
}

async function createSqliteTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "AuditEvents" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "actorId" VARCHAR(255),
            "actorType" VARCHAR(32) NOT NULL DEFAULT 'user',
            "action" VARCHAR(128) NOT NULL,
            "targetType" VARCHAR(64) NOT NULL,
            "targetId" VARCHAR(255),
            "guildId" VARCHAR(255),
            "severity" VARCHAR(16) NOT NULL DEFAULT 'info',
            "status" VARCHAR(16) NOT NULL DEFAULT 'success',
            "requestId" VARCHAR(128),
            "metadata" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await createIndexes(context);
}

async function createPostgresTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "AuditEvents" (
            "id" SERIAL PRIMARY KEY,
            "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "actorId" VARCHAR(255),
            "actorType" VARCHAR(32) NOT NULL DEFAULT 'user',
            "action" VARCHAR(128) NOT NULL,
            "targetType" VARCHAR(64) NOT NULL,
            "targetId" VARCHAR(255),
            "guildId" VARCHAR(255),
            "severity" VARCHAR(16) NOT NULL DEFAULT 'info',
            "status" VARCHAR(16) NOT NULL DEFAULT 'success',
            "requestId" VARCHAR(128),
            "metadata" JSONB,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await createIndexes(context);
}

async function createIndexes(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE INDEX IF NOT EXISTS "ix_auditevents_timestamp"
        ON "AuditEvents" ("timestamp")
    `);

    await context.query(`
        CREATE INDEX IF NOT EXISTS "ix_auditevents_actor"
        ON "AuditEvents" ("actorId")
    `);

    await context.query(`
        CREATE INDEX IF NOT EXISTS "ix_auditevents_action"
        ON "AuditEvents" ("action")
    `);

    await context.query(`
        CREATE INDEX IF NOT EXISTS "ix_auditevents_guild"
        ON "AuditEvents" ("guildId")
    `);

    await context.query(`
        CREATE INDEX IF NOT EXISTS "ix_auditevents_severity_status"
        ON "AuditEvents" ("severity", "status")
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
    await context.query('DROP INDEX IF EXISTS "ix_auditevents_severity_status"');
    await context.query('DROP INDEX IF EXISTS "ix_auditevents_guild"');
    await context.query('DROP INDEX IF EXISTS "ix_auditevents_action"');
    await context.query('DROP INDEX IF EXISTS "ix_auditevents_actor"');
    await context.query('DROP INDEX IF EXISTS "ix_auditevents_timestamp"');
    await context.query('DROP TABLE IF EXISTS "AuditEvents"');
};
