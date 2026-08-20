interface MigrationContext {
    query(sql: string): Promise<unknown>;
}

export const up = async ({ context }: { context: MigrationContext }) => {
    await context.query(`ALTER TABLE "UserConfigs"
        ADD COLUMN "preferredLocale" VARCHAR(8) NULL
        CHECK ("preferredLocale" IS NULL OR "preferredLocale" IN ('en', 'nl'))`);
};

export const down = async ({ context }: { context: MigrationContext }) => {
    await context.query('ALTER TABLE "UserConfigs" DROP COLUMN "preferredLocale"');
};
