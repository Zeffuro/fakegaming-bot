import axios from 'axios';
import Parser from 'rss-parser';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Client,
    EmbedBuilder,
    TextChannel
} from 'discord.js';
import {configManager} from '../config/configManagerSingleton.js';

const apiKey = process.env.YOUTUBE_API_KEY!;
const _liveStatus: Record<string, boolean> = {};
void _liveStatus; // Prevent ESLint unused variable error

const parser = new Parser({
    customFields: {
        item: [
            'yt:videoId',
            'author',
            'published',
            'title',
            ['media:group', 'mediaGroup', {keepArray: false}],
            ['media:community', 'mediaCommunity', {keepArray: false}],
            ['media:thumbnail', 'mediaThumbnail', {keepArray: false}],
            ['media:description', 'mediaDescription', {keepArray: false}],
            ['media:statistics', 'mediaStatistics', {keepArray: false}],
            ['media:starRating', 'mediaStarRating', {keepArray: false}]
        ]
    }
});

/**
 * Gets the YouTube channel ID for a given identifier (channel ID, handle, or username).
 * Returns null if not found.
 */
export async function getYoutubeChannelId(identifier: string): Promise<string | null> {
    const isChannelId = /^UC[\w-]{22}$/.test(identifier);
    const isHandle = identifier.startsWith('@');

    let url = 'https://www.googleapis.com/youtube/v3';

    if (isChannelId) {
        const feed = await getYoutubeChannelFeed(identifier);
        if (feed) {
            return identifier;
        } else {
            return null;
        }
    } else if (isHandle) {
        // Use the 'forHandle' parameter for handles
        const handle = identifier.substring(1);
        url = `${url}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
    } else {
        // Assume it's a legacy username
        url = `${url}/channels?part=id&forUsername=${encodeURIComponent(identifier)}&key=${apiKey}`;
    }

    try {
        const res = await axios.get(url);
        return res.data.items?.[0]?.id ?? null;
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error fetching YouTube channel ID:", error.message);
        } else {
            console.error("Error fetching YouTube channel ID:", error);
        }
        return null;
    }
}

/**
 * Fetches the RSS feed items for a YouTube channel by channel ID.
 * Returns null if no items are found.
 */
export async function getYoutubeChannelFeed(channelId: string) {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    try {
        const feed = await parser.parseURL(feedUrl);
        if (!feed.items || feed.items.length === 0) {
            return null;
        }
        return feed.items;
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error fetching YouTube channel feed:", error.message);
        } else {
            console.error("Error fetching YouTube channel feed:", error);
        }
        return null;
    }
}

/**
 * Checks for new videos on all configured YouTube channels and announces them in Discord.
 */
export async function checkAndAnnounceNewVideos(client: Client) {
    const channels = await configManager.youtubeManager.getAll();

    await Promise.all(channels.map(async (ytChannel) => {
        const feedItems = await getYoutubeChannelFeed(ytChannel.youtubeChannelId);
        if (!feedItems || feedItems.length === 0) return;

        const latestVideo = feedItems[0];
        if (ytChannel.lastVideoId === latestVideo['yt:videoId']) return; // Already announced

        const discordChannel = client.channels.cache.get(ytChannel.discordChannelId);
        if (
            discordChannel &&
            (discordChannel.type === ChannelType.GuildText ||
                discordChannel.type === ChannelType.GuildAnnouncement ||
                discordChannel.type === ChannelType.PublicThread ||
                discordChannel.type === ChannelType.PrivateThread)
        ) {
            const mediaGroup = latestVideo.mediaGroup || {};

            const thumbnailUrl = mediaGroup['media:thumbnail']?.[0]?.$.url
                || latestVideo.mediaThumbnail?.$.url
                || null;

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle(latestVideo.title ?? null)
                .setURL(latestVideo.link ?? null)
                .setAuthor({
                    name: latestVideo.author ?? 'Unknown',
                    url: `https://youtube.com/channel/${ytChannel.youtubeChannelId}`
                })
                .setImage(thumbnailUrl)
                .setTimestamp(new Date(latestVideo.published ?? Date.now()));

            const watchButton = new ButtonBuilder()
                .setLabel('Watch Video')
                .setStyle(ButtonStyle.Link)
                .setURL(latestVideo.link ?? 'https://youtube.com');

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(watchButton);

            const message = ytChannel.customMessage
                ? ytChannel.customMessage.replace('{title}', latestVideo.title ?? 'New Video') + '\n' + latestVideo.link
                : `Hey @everyone, new video from ${latestVideo.author}: ${latestVideo.link}`;

            await (discordChannel as TextChannel).send({content: message, embeds: [embed], components: [row]});

            // Update lastVideoId and persist
            ytChannel.lastVideoId = latestVideo['yt:videoId'];
            await configManager.youtubeManager.setVideoChannel(ytChannel);
        }
    }));
}