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
import {configManager} from '../config/configManagerSingleton.js';

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
    const streams = configManager.twitchManager.getAll();

    await Promise.all(streams.map(async (stream) => {
        const user = await appApiClient.users.getUserByName(stream.twitchUsername);
        if (!user) return;

        const streamData = await appApiClient.streams.getStreamByUserId(user.id);
        const isLive = streamData !== null;

        if (isLive && !liveStatus[user.id]) {
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
                    .setTitle(`${user.displayName} is now live!`)
                    .setURL(`https://twitch.tv/${user.name}`)
                    .setAuthor({
                        name: user.displayName,
                        iconURL: user.profilePictureUrl,
                        url: `https://twitch.tv/${user.name}`
                    })
                    .setDescription(streamData.title || 'Live on Twitch!')
                    .addFields(
                        {name: 'Viewers', value: `${streamData.viewers ?? 'N/A'}`, inline: true}
                    )
                    .setThumbnail(user.profilePictureUrl)
                    .setImage(
                        streamData.thumbnailUrl
                            ? streamData.thumbnailUrl.replace('{width}', '640').replace('{height}', '360')
                            : null
                    )
                    .setTimestamp();

                const message = stream.customMessage
                    ? stream.customMessage.replace('{streamer}', user.displayName)
                    : `Hey @everyone, ${user.displayName} is now live on https://twitch.tv/${user.name} ! Go check it out!`;

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
        }
        liveStatus[user.id] = isLive;
    }));
}