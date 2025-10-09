import { Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    await context.getQueryInterface().addConstraint('BirthdayConfigs', {
        fields: ['userId', 'guildId'],
        type: 'unique',
        name: 'unique_user_guild_birthday',
    });
};

export const down = async ({ context }: { context: Sequelize }) => {
    await context.getQueryInterface().removeConstraint(
        'BirthdayConfigs',
        'unique_user_guild_birthday'
    );
};
