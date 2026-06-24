interface MigrationSequelize {
    query(sql: string): Promise<unknown>;
}

const TABLE = 'QuoteConfigs';
const INDEX = 'ix_quoteconfigs_guild_moderation_status';

export const up = async ({ context }: { context: MigrationSequelize }) => {
    await context.query(`ALTER TABLE "${TABLE}" ADD COLUMN "moderationStatus" VARCHAR(16) NOT NULL DEFAULT 'pending'`);
    await context.query(`CREATE INDEX IF NOT EXISTS "${INDEX}" ON "${TABLE}" ("guildId", "moderationStatus")`);
};

export const down = async ({ context }: { context: MigrationSequelize }) => {
    await context.query(`DROP INDEX IF EXISTS "${INDEX}"`);
    await context.query(`ALTER TABLE "${TABLE}" DROP COLUMN "moderationStatus"`);
};
