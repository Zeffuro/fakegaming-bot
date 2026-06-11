interface MigrationSequelize {
    getDialect(): string;
    query(sql: string): Promise<unknown>;
}

async function createSqliteTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "PatchNoteHistoryConfigs" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "game" VARCHAR(255) NOT NULL,
            "title" VARCHAR(255) NOT NULL,
            "content" TEXT,
            "url" VARCHAR(255) NOT NULL,
            "publishedAt" BIGINT,
            "logoUrl" VARCHAR(255),
            "imageUrl" VARCHAR(255),
            "version" VARCHAR(255),
            "accentColor" INTEGER,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "patch_note_history_game_url"
        ON "PatchNoteHistoryConfigs" ("game", "url")
    `);
}

async function createPostgresTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "PatchNoteHistoryConfigs" (
            "id" SERIAL PRIMARY KEY,
            "game" VARCHAR(255) NOT NULL,
            "title" VARCHAR(255) NOT NULL,
            "content" TEXT,
            "url" VARCHAR(255) NOT NULL,
            "publishedAt" BIGINT,
            "logoUrl" VARCHAR(255),
            "imageUrl" VARCHAR(255),
            "version" VARCHAR(255),
            "accentColor" INTEGER,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await context.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "patch_note_history_game_url"
        ON "PatchNoteHistoryConfigs" ("game", "url")
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
    await context.query('DROP INDEX IF EXISTS "patch_note_history_game_url"');
    await context.query('DROP TABLE IF EXISTS "PatchNoteHistoryConfigs"');
};
