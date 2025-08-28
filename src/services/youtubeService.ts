import axios from 'axios';
import Parser from 'rss-parser';
import {ChannelType, Client, EmbedBuilder, TextChannel, NewsChannel, ThreadChannel} from 'discord.js';
import {configManager} from '../config/configManagerSingleton.js';

const apiKey = process.env.YOUTUBE_API_KEY!;
const liveStatus: Record<string, boolean> = {};

const parser = new Parser();

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

export async function checkAndAnnounceNewVideos(client: Client) {
    const channels = configManager.youtubeManager.getVideoChannels();

    await Promise.all(channels.map(async (ytChannel) => {
        const feedItems = await getYoutubeChannelFeed(ytChannel.youtubeChannelId);
        if (!feedItems || feedItems.length === 0) return;

        const latestVideo = feedItems[0];
        if (ytChannel.lastVideoId === latestVideo.id) return; // Already announced

        const discordChannel = client.channels.cache.get(ytChannel.discordChannelId);
        if (
            discordChannel &&
            (discordChannel.type === ChannelType.GuildText ||
                discordChannel.type === ChannelType.GuildAnnouncement ||
                discordChannel.type === ChannelType.PublicThread ||
                discordChannel.type === ChannelType.PrivateThread)
        ) {
            const mediaGroup = latestVideo.mediaGroup || {};
            const mediaCommunity = latestVideo.mediaCommunity || {};
            const thumbnailUrl = mediaGroup['media:thumbnail']?.$.url ?? null;
            const description = (mediaGroup['media:description'] ?? latestVideo.contentSnippet ?? 'New video!').slice(0, 4000);
            const views = mediaCommunity['media:statistics']?.$.views?.toString() ?? 'N/A';
            const starRating = mediaCommunity['media:starRating']?.$;
            const rating = starRating
                ? `${starRating.average} (${starRating.count} ratings)`
                : 'N/A';

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle(latestVideo.title ?? null)
                .setURL(latestVideo.link ?? null)
                .setAuthor({
                    name: latestVideo.author ?? 'Unknown',
                    url: `https://youtube.com/channel/${ytChannel.youtubeChannelId}`
                })
                .setDescription(description)
                .setThumbnail(thumbnailUrl)
                .addFields(
                    {name: 'Views', value: views, inline: true},
                    {name: 'Rating', value: rating, inline: true},
                    {
                        name: 'Published',
                        value: latestVideo.pubDate ? `<t:${Math.floor(new Date(latestVideo.pubDate).getTime() / 1000)}:f>` : 'N/A',
                        inline: false
                    }
                )
                .setTimestamp(new Date(latestVideo.pubDate ?? Date.now()));

            const message = ytChannel.customMessage
                ? ytChannel.customMessage.replace('{title}', latestVideo.title ?? 'New Video')
                : `Hey @everyone, new video from ${latestVideo.author}: ${latestVideo.link}`;

            await (discordChannel as TextChannel).send({content: message, embeds: [embed]});

            // Update lastVideoId and persist
            ytChannel.lastVideoId = latestVideo.id;
            await configManager.youtubeManager.setVideoChannel(ytChannel);
        }
    }));
}