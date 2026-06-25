interface MigrationSequelize {
    query(sql: string): Promise<unknown>;
}

const TABLE = 'TwitchStreamConfigs';

export const up = async ({ context }: { context: MigrationSequelize }) => {
    await context.query(`ALTER TABLE "${TABLE}" ADD COLUMN "vodFollowupEnabled" BOOLEAN NOT NULL DEFAULT false`);
    await context.query(`ALTER TABLE "${TABLE}" ADD COLUMN "vodFollowupDelayMinutes" INTEGER`);
    await context.query(`ALTER TABLE "${TABLE}" ADD COLUMN "lastVodId" VARCHAR(255)`);
};

export const down = async ({ context }: { context: MigrationSequelize }) => {
    await context.query(`ALTER TABLE "${TABLE}" DROP COLUMN "lastVodId"`);
    await context.query(`ALTER TABLE "${TABLE}" DROP COLUMN "vodFollowupDelayMinutes"`);
    await context.query(`ALTER TABLE "${TABLE}" DROP COLUMN "vodFollowupEnabled"`);
};
