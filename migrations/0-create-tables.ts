import {DataTypes, Sequelize} from 'sequelize';

export const up = async ({context}: { context: Sequelize }) => {
    const qi = context.getQueryInterface();

    // UserConfig
    await qi.createTable('UserConfigs', {
        discordId: {type: DataTypes.STRING, primaryKey: true, allowNull: false},
        timezone: {type: DataTypes.STRING, allowNull: true},
        defaultReminderTimeSpan: {type: DataTypes.STRING, allowNull: true},
        createdAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
        updatedAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
    });

    // LeagueConfig
    await qi.createTable('LeagueConfigs', {
        id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
        summonerName: {type: DataTypes.STRING, allowNull: false},
        region: {type: DataTypes.STRING, allowNull: false},
        puuid: {type: DataTypes.STRING, allowNull: false},
        discordId: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {model: 'UserConfigs', key: 'discordId'},
            onDelete: 'CASCADE'
        },
        createdAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
        updatedAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
    });

    // ServerConfig
    await qi.createTable('ServerConfigs', {
        serverId: {type: DataTypes.STRING, primaryKey: true, allowNull: false},
        prefix: {type: DataTypes.STRING, allowNull: false},
        welcomeMessage: {type: DataTypes.TEXT, allowNull: true},
        createdAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
        updatedAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
    });

    // QuoteConfig
    await qi.createTable('QuoteConfigs', {
        id: {type: DataTypes.STRING, primaryKey: true, allowNull: false},
        guildId: {type: DataTypes.STRING, allowNull: false},
        quote: {type: DataTypes.TEXT, allowNull: false},
        authorId: {type: DataTypes.STRING, allowNull: false},
        submitterId: {type: DataTypes.STRING, allowNull: false},
        timestamp: {type: DataTypes.BIGINT, allowNull: false},
        createdAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
        updatedAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
    });

    // TwitchStreamConfig
    await qi.createTable('TwitchStreamConfigs', {
        id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
        twitchUsername: {type: DataTypes.STRING, allowNull: false},
        discordChannelId: {type: DataTypes.STRING, allowNull: false},
        customMessage: {type: DataTypes.TEXT, allowNull: true},
        createdAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
        updatedAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
    });

    // YoutubeVideoConfig
    await qi.createTable('YoutubeVideoConfigs', {
        id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
        youtubeChannelId: {type: DataTypes.STRING, allowNull: false},
        discordChannelId: {type: DataTypes.STRING, allowNull: false},
        lastVideoId: {type: DataTypes.STRING, allowNull: true},
        customMessage: {type: DataTypes.TEXT, allowNull: true},
        createdAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
        updatedAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
    });

    // ReminderConfig
    await qi.createTable('ReminderConfigs', {
        id: {type: DataTypes.STRING, primaryKey: true, allowNull: false},
        userId: {type: DataTypes.STRING, allowNull: false},
        message: {type: DataTypes.TEXT, allowNull: false},
        timespan: {type: DataTypes.STRING, allowNull: false},
        timestamp: {type: DataTypes.BIGINT, allowNull: false},
        completed: {type: DataTypes.BOOLEAN, allowNull: true},
        createdAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
        updatedAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
    });

    // BirthdayConfig
    await qi.createTable('BirthdayConfigs', {
        userId: {type: DataTypes.STRING, primaryKey: true, allowNull: false},
        day: {type: DataTypes.INTEGER, allowNull: false},
        month: {type: DataTypes.INTEGER, allowNull: false},
        year: {type: DataTypes.INTEGER, allowNull: true},
        guildId: {type: DataTypes.STRING, allowNull: false},
        channelId: {type: DataTypes.STRING, allowNull: false},
        createdAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
        updatedAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
    });

    // PatchNoteConfig
    await qi.createTable('PatchNoteConfigs', {
        id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
        game: {type: DataTypes.STRING, allowNull: false},
        title: {type: DataTypes.STRING, allowNull: false},
        content: {type: DataTypes.TEXT, allowNull: false},
        url: {type: DataTypes.STRING, allowNull: false},
        publishedAt: {type: DataTypes.BIGINT, allowNull: false},
        logoUrl: {type: DataTypes.STRING, allowNull: true},
        imageUrl: {type: DataTypes.STRING, allowNull: true},
        version: {type: DataTypes.STRING, allowNull: true},
        accentColor: {type: DataTypes.INTEGER, allowNull: true},
        createdAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
        updatedAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
    });

    // PatchSubscriptionConfig
    await qi.createTable('PatchSubscriptionConfigs', {
        id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
        game: {type: DataTypes.STRING, allowNull: false},
        channelId: {type: DataTypes.STRING, allowNull: false},
        lastAnnouncedAt: {type: DataTypes.BIGINT, allowNull: true},
        createdAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
        updatedAt: {type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')},
    });
};

export const down = async ({context}: { context: Sequelize }) => {
    const qi = context.getQueryInterface();
    await qi.dropTable('PatchSubscriptionConfigs');
    await qi.dropTable('PatchNoteConfigs');
    await qi.dropTable('BirthdayConfigs');
    await qi.dropTable('ReminderConfigs');
    await qi.dropTable('YoutubeVideoConfigs');
    await qi.dropTable('TwitchStreamConfigs');
    await qi.dropTable('QuoteConfigs');
    await qi.dropTable('ServerConfigs');
    await qi.dropTable('LeagueConfigs');
    await qi.dropTable('UserConfigs');
};