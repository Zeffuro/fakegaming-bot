import {ApiClient, HelixStream, HelixUser} from '@twurple/api';
import {AppTokenAuthProvider} from '@twurple/auth';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Client,
    EmbedBuilder, TextChannel,
} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {TwitchStreamConfig} from "@zeffuro/fakegaming-common";
import {isWithinQuietHours} from '@zeffuro/fakegaming-common/utils';

const clientId = process.env.TWITCH_CLIENT_ID!;
const clientSecret = process.env.TWITCH_CLIENT_SECRET!;

const appAuthProvider = new AppTokenAuthProvider(clientId, clientSecret);
const appApiClient = new ApiClient({authProvider: appAuthProvider});


/**
 * Verify that a Twitch user exists via Twurple API.
 * @param username Twitch channel username.
 * @returns True if user exists; otherwise false.
 */
export async function verifyTwitchUser(username: string): Promise<boolean> {
    const user = await appApiClient.users.getUserByName(username);
    return user !== null;
}

/**
 * Poll all configured Twitch streams and announce when a stream goes live,
 * respecting dedupe, per-config quiet hours, and cooldown suppression.
 * Updates isLive and lastNotifiedAt accordingly.
 * @param client Discord client used to send messages.
 */
export async function subscribeAllStreams(client: Client) {
    const twitchManager = getConfigManager().twitchManager;
    const notifications = getConfigManager().notificationsManager;
    const streams: TwitchStreamConfig[] = await twitchManager.getAllStreams();

    if (!streams.length) return;

    await Promise.all(
        streams.map(async (stream: TwitchStreamConfig, idx: number) => {
            try {
                const user: HelixUser | null = await appApiClient.users.getUserByName(stream.twitchUsername);
                if (!user) return;

                const streamData: HelixStream | null = await appApiClient.streams.getStreamByUserId(user.id);
                const isLive = streamData !== null;

                if (isLive && !stream.isLive) {
                    const now = new Date();

                    // Dedupe by provider event id
                    const eventId = String((streamData as any).id);
                    const alreadyNotified = await notifications.has('twitch', eventId);

                    // Suppression conditions
                    const suppressedByQuiet = isWithinQuietHours(
                        (stream as any).quietHoursStart ?? null,
                        (stream as any).quietHoursEnd ?? null,
                        now
                    );
                    const cooldownMinutes = (stream as any).cooldownMinutes as number | null | undefined;
                    const lastNotifiedAt = (stream as any).lastNotifiedAt as Date | string | null | undefined;
                    const lastNotifiedDate = lastNotifiedAt ? new Date(lastNotifiedAt) : null;
                    const suppressedByCooldown = typeof cooldownMinutes === 'number' && cooldownMinutes > 0 && lastNotifiedDate
                        ? (now.getTime() - lastNotifiedDate.getTime()) < cooldownMinutes * 60_000
                        : false;

                    if (!alreadyNotified && !suppressedByQuiet && !suppressedByCooldown) {
                        await announceLiveStream(client, stream, user, streamData!);
                        (stream as any).lastNotifiedAt = now;
                        await notifications.recordIfNew({
                            provider: 'twitch',
                            eventId,
                            guildId: stream.guildId,
                            channelId: stream.discordChannelId
                        });
                    }

                    // Mark as live regardless to avoid reprocessing spam in this session
                    stream.isLive = true;
                    await stream.save();
                } else if (!isLive && stream.isLive) {
                    stream.isLive = false;
                    await stream.save();
                }
            } catch (err) {
                console.error(`[TwitchService] Error processing stream #${idx}:`, err);
            }
        })
    );
}

async function announceLiveStream(client: Client, stream: TwitchStreamConfig, user: HelixUser, streamData: HelixStream) {
    const channel = client.channels.cache.get(stream.discordChannelId);
    if (
        !channel ||
        !(
            channel.type === ChannelType.GuildText ||
            channel.type === ChannelType.GuildAnnouncement ||
            channel.type === ChannelType.PublicThread ||
            channel.type === ChannelType.PrivateThread
        )
    ) {
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(0x9146ff)
        .setTitle(`${user.displayName || user.name} is now live!`)
        .setURL(`https://twitch.tv/${user.name}`)
        .setAuthor({
            name: user.displayName || user.name,
            iconURL: user.profilePictureUrl || undefined,
            url: `https://twitch.tv/${user.name}`,
        })
        .setDescription(streamData.title || 'Live on Twitch!')
        .addFields({ name: 'Viewers', value: `${(streamData as any).viewers ?? 'N/A'}`, inline: true })
        .setThumbnail(user.profilePictureUrl || null)
        .setImage(
            (streamData as any).thumbnailUrl
                ? (streamData as any).thumbnailUrl.replace('{width}', '640').replace('{height}', '360')
                : null
        )
        .setTimestamp();

    const watchButton = new ButtonBuilder()
        .setLabel('Watch Stream')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://twitch.tv/${user.name}`);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(watchButton);

    const message =
        stream.customMessage?.replace('{streamer}', user.displayName || user.name) ||
        `Hey @everyone, ${user.displayName || user.name} is now live on https://twitch.tv/${user.name}!`;

    await (channel as TextChannel).send({
        content: message,
        embeds: [embed],
        components: [row],
    });
}