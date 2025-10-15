import { DataTypes, Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();

    // Unique per-guild subscription constraints
    await qi.addConstraint('TwitchStreamConfigs', {
        fields: ['guildId', 'twitchUsername'],
        type: 'unique',
        name: 'unique_guild_twitch_username'
    });
    await qi.addConstraint('YoutubeVideoConfigs', {
        fields: ['guildId', 'youtubeChannelId'],
        type: 'unique',
        name: 'unique_guild_youtube_channel'
    });

    // Hot-path indexes
    // Quotes: fast filter by guild + createdAt
    await qi.addIndex('QuoteConfigs', ['guildId', 'createdAt'], { name: 'ix_quoteconfigs_guild_createdAt' });

    // Subscriptions/feeds: quick lookups by provider source IDs
    await qi.addIndex('TwitchStreamConfigs', ['twitchUsername'], { name: 'ix_twitchstreamconfigs_username' });
    await qi.addIndex('YoutubeVideoConfigs', ['youtubeChannelId'], { name: 'ix_youtubevideoconfigs_channel' });

    // Reminders: index by (userId, timestamp) for upcoming checks
    await qi.addIndex('ReminderConfigs', ['userId', 'timestamp'], { name: 'ix_reminderconfigs_user_timestamp' });

    // Patch subscriptions: speedy guild+game lookups
    await qi.addIndex('PatchSubscriptionConfigs', ['guildId', 'game'], { name: 'ix_patchsubs_guild_game' });
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();

    // Drop indexes
    await qi.removeIndex('PatchSubscriptionConfigs', 'ix_patchsubs_guild_game');
    await qi.removeIndex('ReminderConfigs', 'ix_reminderconfigs_user_timestamp');
    await qi.removeIndex('YoutubeVideoConfigs', 'ix_youtubevideoconfigs_channel');
    await qi.removeIndex('TwitchStreamConfigs', 'ix_twitchstreamconfigs_username');
    await qi.removeIndex('QuoteConfigs', 'ix_quoteconfigs_guild_createdAt');

    // Drop unique constraints
    await qi.removeConstraint('YoutubeVideoConfigs', 'unique_guild_youtube_channel');
    await qi.removeConstraint('TwitchStreamConfigs', 'unique_guild_twitch_username');
};
