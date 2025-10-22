import { getSequelize } from '@zeffuro/fakegaming-common';
import { TwitchStreamConfig, YoutubeVideoConfig, QuoteConfig, ServerConfig, UserConfig } from '@zeffuro/fakegaming-common';
async function main() {
    process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';
    const sequelize = getSequelize(false);
    // Migrations are typically run by the app; run a sync here to ensure tables exist in dev
    await sequelize.authenticate();
    // Seed a server and user
    await ServerConfig.findOrCreate({
        where: { serverId: 'guild-seed-1' },
        defaults: { serverId: 'guild-seed-1', prefix: '!' }
    });
    await UserConfig.findOrCreate({
        where: { discordId: 'user-seed-1' },
        defaults: { discordId: 'user-seed-1', timezone: 'UTC' }
    });
    // Seed Twitch stream config
    await TwitchStreamConfig.findOrCreate({
        where: { twitchUsername: 'faker_streamer', guildId: 'guild-seed-1' },
        defaults: {
            twitchUsername: 'faker_streamer',
            discordChannelId: 'channel-seed-1',
            guildId: 'guild-seed-1',
            isLive: false,
        }
    });
    // Seed YouTube channel config
    await YoutubeVideoConfig.findOrCreate({
        where: { youtubeChannelId: 'UC1234567890', guildId: 'guild-seed-1' },
        defaults: {
            youtubeChannelId: 'UC1234567890',
            discordChannelId: 'channel-seed-2',
            guildId: 'guild-seed-1'
        }
    });
    // Seed a quote
    await QuoteConfig.findOrCreate({
        where: { id: 'quote-seed-1' },
        defaults: {
            id: 'quote-seed-1',
            guildId: 'guild-seed-1',
            quote: 'We are live, folks!',
            authorId: 'user-seed-1',
            submitterId: 'user-seed-1',
            timestamp: Date.now(),
        }
    });
    console.log('Seed complete.');
}
main().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
