import { Sequelize } from 'sequelize';

export const up = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();

    // Use raw SQL with IF NOT EXISTS to make this migration idempotent across reruns (especially in SQLite)
    // Unique per-guild subscription constraints via unique indexes
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS unique_guild_twitch_username ON `TwitchStreamConfigs` ("guildId", "twitchUsername")');
    await context.query('CREATE UNIQUE INDEX IF NOT EXISTS unique_guild_youtube_channel ON `YoutubeVideoConfigs` ("guildId", "youtubeChannelId")');

    // Hot-path indexes
    await context.query('CREATE INDEX IF NOT EXISTS ix_quoteconfigs_guild_createdAt ON `QuoteConfigs` ("guildId", "createdAt")');
    await context.query('CREATE INDEX IF NOT EXISTS ix_twitchstreamconfigs_username ON `TwitchStreamConfigs` ("twitchUsername")');
    await context.query('CREATE INDEX IF NOT EXISTS ix_youtubevideoconfigs_channel ON `YoutubeVideoConfigs` ("youtubeChannelId")');
    await context.query('CREATE INDEX IF NOT EXISTS ix_reminderconfigs_user_timestamp ON `ReminderConfigs` ("userId", "timestamp")');
    await context.query('CREATE INDEX IF NOT EXISTS ix_patchsubs_guild_game ON `PatchSubscriptionConfigs` ("guildId", "game")');
};

export const down = async ({ context }: { context: Sequelize }) => {
    const qi = context.getQueryInterface();

    // Drop indexes safely if present
    await context.query('DROP INDEX IF EXISTS ix_patchsubs_guild_game');
    await context.query('DROP INDEX IF EXISTS ix_reminderconfigs_user_timestamp');
    await context.query('DROP INDEX IF EXISTS ix_youtubevideoconfigs_channel');
    await context.query('DROP INDEX IF EXISTS ix_twitchstreamconfigs_username');
    await context.query('DROP INDEX IF EXISTS ix_quoteconfigs_guild_createdAt');

    // Drop unique indexes
    await context.query('DROP INDEX IF EXISTS unique_guild_youtube_channel');
    await context.query('DROP INDEX IF EXISTS unique_guild_twitch_username');
};
