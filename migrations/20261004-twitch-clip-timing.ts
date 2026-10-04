interface MigrationDatabase {
    getDialect(): string;
    query(sql: string): Promise<unknown>;
}

const timestampColumns: Record<string, string[]> = {
    TwitchClipConfigs: ['createdAt', 'updatedAt'],
    TwitchClipRequests: ['requestedAt', 'createdAt', 'updatedAt', 'replyAttemptedAt'],
    TwitchClipCooldowns: ['availableAt', 'createdAt', 'updatedAt'],
    TwitchClipBotAuths: ['expiresAt', 'createdAt', 'updatedAt'],
    TwitchClipOAuthStates: ['expiresAt', 'createdAt', 'updatedAt'],
};

export const up = async ({ context }: { context: MigrationDatabase }) => {
    if (context.getDialect() === 'postgres') {
        // Sequelize writes these legacy timestamp columns with its default UTC offset.
        for (const [table, columns] of Object.entries(timestampColumns)) {
            const changes = columns.map(column =>
                `ALTER COLUMN "${column}" TYPE TIMESTAMPTZ USING "${column}" AT TIME ZONE 'UTC'`);
            await context.query(`ALTER TABLE "${table}" ${changes.join(', ')}`);
        }
    }
    const timestampType = context.getDialect() === 'postgres' ? 'TIMESTAMPTZ' : 'TIMESTAMP';
    await context.query(`ALTER TABLE "TwitchClipRequests" ADD COLUMN "clipAcceptedAt" ${timestampType}`);
};

export const down = async ({ context }: { context: MigrationDatabase }) => {
    await context.query('ALTER TABLE "TwitchClipRequests" DROP COLUMN "clipAcceptedAt"');
    if (context.getDialect() === 'postgres') {
        for (const [table, columns] of Object.entries(timestampColumns)) {
            const changes = columns.map(column =>
                `ALTER COLUMN "${column}" TYPE TIMESTAMP USING "${column}" AT TIME ZONE 'UTC'`);
            await context.query(`ALTER TABLE "${table}" ${changes.join(', ')}`);
        }
    }
};
