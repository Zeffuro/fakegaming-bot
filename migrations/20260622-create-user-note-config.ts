interface MigrationSequelize {
    getDialect(): string;
    query(sql: string): Promise<unknown>;
}

async function createSqliteTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "UserNoteConfigs" (
            "id" VARCHAR(255) PRIMARY KEY,
            "discordId" VARCHAR(255) NOT NULL,
            "title" VARCHAR(160) NOT NULL,
            "body" TEXT NOT NULL,
            "pinned" BOOLEAN NOT NULL DEFAULT 0,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE INDEX IF NOT EXISTS "idx_user_notes_discord_updated"
        ON "UserNoteConfigs" ("discordId", "updatedAt")
    `);
}

async function createPostgresTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "UserNoteConfigs" (
            "id" VARCHAR(255) PRIMARY KEY,
            "discordId" VARCHAR(255) NOT NULL,
            "title" VARCHAR(160) NOT NULL,
            "body" TEXT NOT NULL,
            "pinned" BOOLEAN NOT NULL DEFAULT FALSE,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE INDEX IF NOT EXISTS "idx_user_notes_discord_updated"
        ON "UserNoteConfigs" ("discordId", "updatedAt")
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
    await context.query('DROP INDEX IF EXISTS "idx_user_notes_discord_updated"');
    await context.query('DROP TABLE IF EXISTS "UserNoteConfigs"');
};
