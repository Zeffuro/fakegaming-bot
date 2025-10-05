import {Sequelize} from 'sequelize';

/**
 * Migration: Add auto-incrementing 'id' primary key to YoutubeVideoConfigs and TwitchStreamConfigs tables.
 */
export const up = async ({context}: { context: Sequelize }) => {
    const queryInterface = context.getQueryInterface();

    // YoutubeVideoConfigs
    const youtubeTable = await queryInterface.describeTable('YoutubeVideoConfigs');
    if (!youtubeTable.id) {
        await queryInterface.addColumn('YoutubeVideoConfigs', 'id', {
            type: 'INTEGER',
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
            unique: true,
        });
    }

    // TwitchStreamConfigs
    const twitchTable = await queryInterface.describeTable('TwitchStreamConfigs');
    if (!twitchTable.id) {
        await queryInterface.addColumn('TwitchStreamConfigs', 'id', {
            type: 'INTEGER',
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
            unique: true,
        });
    }
};

export const down = async ({context}: { context: Sequelize }) => {
    const queryInterface = context.getQueryInterface();

    // YoutubeVideoConfigs
    const youtubeTable = await queryInterface.describeTable('YoutubeVideoConfigs');
    if (youtubeTable.id) {
        await queryInterface.removeColumn('YoutubeVideoConfigs', 'id');
    }

    // TwitchStreamConfigs
    const twitchTable = await queryInterface.describeTable('TwitchStreamConfigs');
    if (twitchTable.id) {
        await queryInterface.removeColumn('TwitchStreamConfigs', 'id');
    }
};

