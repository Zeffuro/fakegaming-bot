interface MigrationSequelize {
    getDialect(): string;
    query(sql: string): Promise<unknown>;
}

const TABLE = 'RolePermissionSnapshots';
const INDEX = 'idx_role_permission_snapshots_guild_created';

async function createSqliteTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "${TABLE}" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "guildId" VARCHAR(255) NOT NULL,
            "guildName" VARCHAR(255) NOT NULL,
            "createdById" VARCHAR(255) NOT NULL,
            "snapshot" JSON NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function createPostgresTable(context: MigrationSequelize): Promise<void> {
    await context.query(`
        CREATE TABLE IF NOT EXISTS "${TABLE}" (
            "id" SERIAL PRIMARY KEY,
            "guildId" VARCHAR(255) NOT NULL,
            "guildName" VARCHAR(255) NOT NULL,
            "createdById" VARCHAR(255) NOT NULL,
            "snapshot" JSONB NOT NULL,
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
        CREATE INDEX IF NOT EXISTS "${INDEX}"
        ON "${TABLE}" ("guildId", "createdAt")
    `);
};

export const down = async ({ context }: { context: MigrationSequelize }) => {
    await context.query(`DROP INDEX IF EXISTS "${INDEX}"`);
    await context.query(`DROP TABLE IF EXISTS "${TABLE}"`);
};
