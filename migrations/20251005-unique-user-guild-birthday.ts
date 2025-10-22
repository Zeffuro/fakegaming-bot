import { Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    // Use a unique index to enforce constraint; add IF NOT EXISTS for idempotency across reruns
    await context.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS unique_user_guild_birthday ON `BirthdayConfigs` ("userId", "guildId")'
    );
};

export const down = async ({ context }: { context: Sequelize }) => {
    await context.query('DROP INDEX IF EXISTS unique_user_guild_birthday');
};
