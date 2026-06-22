interface MigrationSequelize {
    query(sql: string): Promise<unknown>;
    getDialect(): string;
}

const TABLES = [
    'PatchSubscriptionConfigs',
    'AnimeSubscriptionConfigs',
];

export const up = async ({ context }: { context: MigrationSequelize }) => {
    const defaultValue = context.getDialect() === 'sqlite' ? 0 : 'FALSE';
    for (const table of TABLES) {
        await context.query(`ALTER TABLE "${table}" ADD COLUMN "paused" BOOLEAN NOT NULL DEFAULT ${defaultValue}`);
    }
};

export const down = async ({ context }: { context: MigrationSequelize }) => {
    for (const table of [...TABLES].reverse()) {
        await context.query(`ALTER TABLE "${table}" DROP COLUMN "paused"`);
    }
};
