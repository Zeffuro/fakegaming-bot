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
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';

const apiKey = process.env.YOUTUBE_API_KEY!;
const _liveStatus: Record<string, boolean> = {};
void _liveStatus;

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
        const handle = identifier.substring(1);
        url = `${url}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
    } else {
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
    const youtubeManager = getConfigManager().youtubeManager;
    const channels = await youtubeManager.getAllChannels();

    if (!channels || channels.length === 0) return;

    await Promise.all(channels.map(async (ytChannel) => {
        if (!ytChannel.youtubeChannelId || !ytChannel.discordChannelId) return;

        const feedItems = await getYoutubeChannelFeed(ytChannel.youtubeChannelId);
        if (!feedItems || feedItems.length === 0) return;

        let newVideos: typeof feedItems = [];
        if (ytChannel.lastVideoId) {
            const idx = feedItems.findIndex(item => item['yt:videoId'] === ytChannel.lastVideoId);
            newVideos = idx === 0 ? [] : idx > 0 ? feedItems.slice(0, idx).reverse() : [feedItems[0]];
        } else {
            newVideos = [feedItems[0]];
        }

        if (newVideos.length === 0) return;

        const discordChannel = client.channels.cache.get(ytChannel.discordChannelId);
        if (
            discordChannel &&
            (discordChannel.type === ChannelType.GuildText ||
                discordChannel.type === ChannelType.GuildAnnouncement)
        ) {
            for (const video of newVideos) {
                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle(video.title ?? null)
                    .setURL(video.link ?? null)
                    .setAuthor({
                        name: video.author ?? 'Unknown',
                        url: `https://youtube.com/channel/${ytChannel.youtubeChannelId}`
                    })
                    .setImage(video.mediaThumbnail?.$.url ?? null)
                    .setTimestamp(new Date(video.published ?? Date.now()));

                const watchButton = new ButtonBuilder()
                    .setLabel('Watch Video')
                    .setStyle(ButtonStyle.Link)
                    .setURL(video.link ?? 'https://youtube.com');

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(watchButton);
                const message = ytChannel.customMessage
                    ? ytChannel.customMessage.replace('{title}', video.title ?? 'New Video') + '\n' + video.link
                    : `Hey @everyone, new video from ${video.author}: ${video.link}`;

                await (discordChannel as TextChannel).send({ content: message, embeds: [embed], components: [row] });
            }

            ytChannel.lastVideoId = newVideos[0]['yt:videoId'];
            await ytChannel.save();
        }
    }));
}