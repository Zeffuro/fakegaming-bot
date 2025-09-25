import {Sequelize} from 'sequelize-typescript';

export const up = async ({context}: { context: Sequelize }) => {
    await context.getQueryInterface().addConstraint('PatchSubscriptionConfigs', {
        fields: ['game', 'channelId'],
        type: 'unique',
        name: 'unique_game_channel_patch_subscription'
    });
};

export const down = async ({context}: { context: Sequelize }) => {
    await context.getQueryInterface().removeConstraint('PatchSubscriptionConfigs', 'unique_game_channel_patch_subscription');
};