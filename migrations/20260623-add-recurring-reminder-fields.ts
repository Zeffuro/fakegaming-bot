interface MigrationSequelize {
    query(sql: string): Promise<unknown>;
}

const TABLE = 'ReminderConfigs';

export const up = async ({ context }: { context: MigrationSequelize }) => {
    await context.query(`ALTER TABLE "${TABLE}" ADD COLUMN "recurrenceUnit" VARCHAR(16)`);
    await context.query(`ALTER TABLE "${TABLE}" ADD COLUMN "recurrenceInterval" INTEGER`);
    await context.query(`ALTER TABLE "${TABLE}" ADD COLUMN "recurrenceTimezone" VARCHAR(255)`);
    await context.query(`ALTER TABLE "${TABLE}" ADD COLUMN "lastTriggeredAt" BIGINT`);
};

export const down = async ({ context }: { context: MigrationSequelize }) => {
    await context.query(`ALTER TABLE "${TABLE}" DROP COLUMN "lastTriggeredAt"`);
    await context.query(`ALTER TABLE "${TABLE}" DROP COLUMN "recurrenceTimezone"`);
    await context.query(`ALTER TABLE "${TABLE}" DROP COLUMN "recurrenceInterval"`);
    await context.query(`ALTER TABLE "${TABLE}" DROP COLUMN "recurrenceUnit"`);
};
