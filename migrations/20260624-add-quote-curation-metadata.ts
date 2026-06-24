interface MigrationSequelize {
    query(sql: string): Promise<unknown>;
}

const TABLE = 'QuoteConfigs';

export const up = async ({ context }: { context: MigrationSequelize }) => {
    await context.query(`ALTER TABLE "${TABLE}" ADD COLUMN "tags" TEXT`);
    await context.query(`ALTER TABLE "${TABLE}" ADD COLUMN "source" VARCHAR(255)`);
    await context.query(`ALTER TABLE "${TABLE}" ADD COLUMN "context" TEXT`);
};

export const down = async ({ context }: { context: MigrationSequelize }) => {
    await context.query(`ALTER TABLE "${TABLE}" DROP COLUMN "context"`);
    await context.query(`ALTER TABLE "${TABLE}" DROP COLUMN "source"`);
    await context.query(`ALTER TABLE "${TABLE}" DROP COLUMN "tags"`);
};
