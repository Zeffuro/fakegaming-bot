import { db } from '../packages/bot/src/config/db.ts';
import { getSequelize } from '@zeffuro/fakegaming-common/dist/sequelize.js';
import { UserConfig } from '@zeffuro/fakegaming-common/dist/models/user-config.js';
import { LeagueConfig } from '@zeffuro/fakegaming-common/dist/models/league-config.js';
import { ServerConfig } from '@zeffuro/fakegaming-common/dist/models/server-config.js';
import { QuoteConfig } from '@zeffuro/fakegaming-common/dist/models/quote-config.js';
import { TwitchStreamConfig } from '@zeffuro/fakegaming-common/dist/models/twitch-stream-config.js';
import { YoutubeVideoConfig } from '@zeffuro/fakegaming-common/dist/models/youtube-video-config.js';
import { ReminderConfig } from '@zeffuro/fakegaming-common/dist/models/reminder-config.js';
import { BirthdayConfig } from '@zeffuro/fakegaming-common/dist/models/birthday-config.js';
import { PatchNoteConfig } from '@zeffuro/fakegaming-common/dist/models/patch-note-config.js';
import { PatchSubscriptionConfig } from '@zeffuro/fakegaming-common/dist/models/patch-subscription-config.js';
async function migrateLowdbToSequelize() {
    await getSequelize().sync({ force: true });
    await db.read();
    console.log('Migrating users:', db.data.users?.length ?? 0);
    for (const user of db.data.users) {
        if (typeof user.discordId === 'string' && user.discordId.length > 0) {
            const userRecord = await UserConfig.create({
                discordId: user.discordId,
                timezone: user.timezone,
                defaultReminderTimeSpan: user.defaultReminderTimeSpan,
            });
            // Now, create the LeagueConfig for this user if it exists
            if (user.league) {
                await LeagueConfig.create({
                    summonerName: user.league.summonerName,
                    region: user.league.region,
                    puuid: user.league.puuid,
                    discordId: userRecord.discordId,
                });
            }
        }
    }
    for (const server of db.data.servers) {
        const existing = await ServerConfig.findOne({ where: { serverId: server.serverId } });
        if (!existing) {
            await ServerConfig.create(server);
        }
    }
    for (const quote of db.data.quotes) {
        const existing = await QuoteConfig.findOne({ where: { id: quote.id } });
        if (!existing) {
            await QuoteConfig.create(quote);
        }
    }
    for (const stream of db.data.twitchStreams) {
        const existing = await TwitchStreamConfig.findOne({
            where: {
                twitchUsername: stream.twitchUsername,
                discordChannelId: stream.discordChannelId
            }
        });
        if (!existing) {
            await TwitchStreamConfig.create(stream);
        }
    }
    for (const yt of db.data.youtubeVideoChannels) {
        const existing = await YoutubeVideoConfig.findOne({
            where: {
                youtubeChannelId: yt.youtubeChannelId,
                discordChannelId: yt.discordChannelId
            }
        });
        if (!existing) {
            await YoutubeVideoConfig.create(yt);
        }
    }
    for (const reminder of db.data.reminders) {
        const existing = await ReminderConfig.findOne({ where: { id: reminder.id } });
        if (!existing) {
            await ReminderConfig.create(reminder);
        }
    }
    for (const birthday of db.data.birthdays) {
        const existing = await BirthdayConfig.findOne({ where: { userId: birthday.userId, guildId: birthday.guildId } });
        if (!existing) {
            await BirthdayConfig.create(birthday);
        }
    }
    for (const note of db.data.patchNotes) {
        const existing = await PatchNoteConfig.findOne({
            where: {
                game: note.game,
                title: note.title,
                publishedAt: note.publishedAt
            }
        });
        if (!existing) {
            await PatchNoteConfig.create(note);
        }
    }
    for (const sub of db.data.patchSubscriptions) {
        const existing = await PatchSubscriptionConfig.findOne({ where: { game: sub.game, channelId: sub.channelId } });
        if (!existing) {
            await PatchSubscriptionConfig.create(sub);
        }
    }
    console.log('Migration complete.');
    process.exit(0);
}
migrateLowdbToSequelize().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
