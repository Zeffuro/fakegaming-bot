import { runtimeText } from '../../../core/runtimeCopy.js';
import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {resolveYoutubeChannelIdApi} from '../../../utils/apiClient.js';
import {youtubeLatest as META} from '../commands.manifest.js';
import {resolveInteractionOutputLocale, type SupportedOutputLocale} from '../../../core/localization.js';

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

function parseLatestVideo(xml: string, locale: SupportedOutputLocale): YoutubeFeedVideo | null {
    const entry = /<entry>([\s\S]*?)<\/entry>/.exec(xml)?.[1];
    if (!entry) return null;
    const id = getXmlTag(entry, 'yt:videoId');
    const title = getXmlTag(entry, 'title');
    const authorBlock = /<author>([\s\S]*?)<\/author>/.exec(entry)?.[1] ?? '';
    const author = getXmlTag(authorBlock, 'name') ?? (runtimeText(locale, "youtube", "unknownChannel"));
    if (!id || !title) return null;
    return {id, title, author, published: getXmlTag(entry, 'published') ?? undefined};
}

async function execute(interaction: ChatInputCommandInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    const input = interaction.options.getString('channel', true).trim();
    let channelId: string | null;
    try {
        channelId = input.startsWith('UC') ? input : await resolveYoutubeChannelIdApi(input);
    } catch {
        await interaction.reply(runtimeText(locale, 'youtube', 'couldNotResolveYoutubeChannel', {channel: input}));
        return;
    }
    if (!channelId) {
        await interaction.reply(runtimeText(locale, 'youtube', 'couldNotResolveYoutubeChannel', {channel: input}));
        return;
    }

    let response: Response;
    try {
        response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
    } catch {
        await interaction.reply(runtimeText(locale, 'youtube', 'couldNotFetchYoutubeFeedFor', {channel: input}));
        return;
    }

    if (!response.ok) {
        await interaction.reply(runtimeText(locale, 'youtube', 'couldNotFetchYoutubeFeedFor', {channel: input}));
        return;
    }

    const latest = parseLatestVideo(await response.text(), locale);
    if (!latest) {
        await interaction.reply(runtimeText(locale, 'youtube', 'noVideosFoundFor', {channel: input}));
        return;
    }

    const published = latest.published
        ? `\n${runtimeText(locale, "youtube", "published")} <t:${Math.floor(Date.parse(latest.published) / 1000)}:R>`
        : '';
    await interaction.reply(runtimeText(locale, 'youtube', 'latestVideo', {
        author: latest.author, title: latest.title, published, videoId: latest.id,
    }));
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
