interface MigrationContext {
    query(sql: string): Promise<unknown>;
}

const TABLE = 'GuildLocaleConfigs';

export const up = async ({ context }: { context: MigrationContext }) => {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "${TABLE}" (
            "guildId" VARCHAR(255) PRIMARY KEY,
            "outputLocale" VARCHAR(8) NOT NULL DEFAULT 'en' CHECK ("outputLocale" IN ('en', 'nl')),
            "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

export const down = async ({ context }: { context: MigrationContext }) => {
    await context.query(`DROP TABLE IF EXISTS "${TABLE}"`);
};
