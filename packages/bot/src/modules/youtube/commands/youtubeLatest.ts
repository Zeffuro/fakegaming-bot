import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {resolveYoutubeChannelIdApi} from '../../../utils/apiClient.js';
import {youtubeLatest as META} from '../commands.manifest.js';

interface YoutubeFeedVideo {
    id: string;
    title: string;
    author: string;
    published?: string;
}

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addStringOption(option =>
        option
            .setName('channel')
            .setDescription('YouTube channel ID, handle, URL, or username')
            .setRequired(true)
    )
);

function decodeXml(value: string): string {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function getXmlTag(xml: string, tag: string): string | null {
    const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(xml);
    return match ? decodeXml(match[1].trim()) : null;
}

function parseLatestVideo(xml: string): YoutubeFeedVideo | null {
    const entry = /<entry>([\s\S]*?)<\/entry>/.exec(xml)?.[1];
    if (!entry) return null;
    const id = getXmlTag(entry, 'yt:videoId');
    const title = getXmlTag(entry, 'title');
    const authorBlock = /<author>([\s\S]*?)<\/author>/.exec(entry)?.[1] ?? '';
    const author = getXmlTag(authorBlock, 'name') ?? 'Unknown channel';
    if (!id || !title) return null;
    return {id, title, author, published: getXmlTag(entry, 'published') ?? undefined};
}

async function execute(interaction: ChatInputCommandInteraction) {
    const input = interaction.options.getString('channel', true).trim();
    const channelId = input.startsWith('UC') ? input : await resolveYoutubeChannelIdApi(input);
    if (!channelId) {
        await interaction.reply(`Could not resolve YouTube channel \`${input}\`.`);
        return;
    }

    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);

    if (!response.ok) {
        await interaction.reply(`Could not fetch YouTube feed for \`${input}\`.`);
        return;
    }

    const latest = parseLatestVideo(await response.text());
    if (!latest) {
        await interaction.reply(`No videos found for \`${input}\`.`);
        return;
    }

    const published = latest.published ? `\nPublished <t:${Math.floor(Date.parse(latest.published) / 1000)}:R>` : '';
    await interaction.reply(`Latest video from ${latest.author}: **${latest.title}**${published}\nhttps://www.youtube.com/watch?v=${latest.id}`);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
