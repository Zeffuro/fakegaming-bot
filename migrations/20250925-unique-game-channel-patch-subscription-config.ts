import {Sequelize} from 'sequelize';

export const up = async ({context}: { context: Sequelize }) => {
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS unique_game_channel_patch_subscription ON `PatchSubscriptionConfigs` ("game", "channelId")');
};

export const down = async ({context}: { context: Sequelize }) => {
    await context.query('DROP INDEX IF EXISTS unique_game_channel_patch_subscription');
};