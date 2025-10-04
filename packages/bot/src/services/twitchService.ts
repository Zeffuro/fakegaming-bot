import {ApiClient} from '@twurple/api';
import {AppTokenAuthProvider} from '@twurple/auth';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Client,
    EmbedBuilder
} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';

const clientId = process.env.TWITCH_CLIENT_ID!;
const clientSecret = process.env.TWITCH_CLIENT_SECRET!;

const appAuthProvider = new AppTokenAuthProvider(clientId, clientSecret);
const appApiClient = new ApiClient({authProvider: appAuthProvider});

const liveStatus: Record<string, boolean> = {};

/**
 * Verifies if a Twitch user exists by username.
 * Returns true if found, false otherwise.
 */
export async function verifyTwitchUser(username: string): Promise<boolean> {
    const user = await appApiClient.users.getUserByName(username);
    return user !== null;
}

/**
 * Subscribes to all configured Twitch streams and announces when they go live.
 */
export async function subscribeAllStreams(client: Client) {
    const streams = await getConfigManager().twitchManager.getAllPlain();
    console.debug('[TwitchService] Streams:', streams);
    if (!streams || !Array.isArray(streams) || streams.length === 0) {
        console.debug('[TwitchService] No streams to process');
        return;
    }

    await Promise.all(streams.map(async (stream, idx) => {
        try {
            console.debug(`[TwitchService] Processing stream #${idx}:`, stream);
            const user = await appApiClient.users.getUserByName(stream.twitchUsername);
            console.debug(`[TwitchService] User for ${stream.twitchUsername}:`, user);
            if (!user) return;

            const streamData = await appApiClient.streams.getStreamByUserId(user.id);
            console.debug(`[TwitchService] Stream data for user ${user.id}:`, streamData);
            const isLive = streamData !== null;

            // Only announce if live and not already announced
            if (isLive && !liveStatus[user.id]) {
                liveStatus[user.id] = true;
                const channel = client.channels.cache.get(stream.discordChannelId);
                if (
                    channel &&
                    (channel.type === ChannelType.GuildText ||
                        channel.type === ChannelType.GuildAnnouncement ||
                        channel.type === ChannelType.PublicThread ||
                        channel.type === ChannelType.PrivateThread)
                ) {
                    const embed = new EmbedBuilder()
                        .setColor(0x9146FF)
                        .setTitle(`${user.displayName || user.name || 'Streamer'} is now live!`)
                        .setURL(user.name ? `https://twitch.tv/${user.name}` : null)
                        .setAuthor({
                            name: user.displayName || user.name || 'Streamer',
                            iconURL: user.profilePictureUrl || undefined,
                            url: user.name ? `https://twitch.tv/${user.name}` : undefined
                        })
                        .setDescription(streamData.title || 'Live on Twitch!')
                        .addFields(
                            {name: 'Viewers', value: `${streamData.viewers ?? 'N/A'}`, inline: true}
                        )
                        .setThumbnail(user.profilePictureUrl || null)
                        .setImage(
                            streamData.thumbnailUrl
                                ? streamData.thumbnailUrl.replace('{width}', '640').replace('{height}', '360')
                                : null
                        )
                        .setTimestamp();

                    const message = stream.customMessage
                        ? stream.customMessage.replace('{streamer}', user.displayName || user.name || 'Streamer')
                        : `Hey @everyone, ${user.displayName || user.name || 'Streamer'} is now live on https://twitch.tv/${user.name || ''} ! Go check it out!`;

                    const watchButton = new ButtonBuilder()
                        .setLabel('Watch Stream')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`https://twitch.tv/${user.name}`);

                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(watchButton);

                    await channel.send({
                        content: message,
                        embeds: [embed],
                        components: [row]
                    });
                }
            } else if (!isLive && liveStatus[user.id]) {
                liveStatus[user.id] = false;
            }
        } catch (err) {
            console.error(`[TwitchService] Error processing stream #${idx}:`, err);
        }
    }));
}