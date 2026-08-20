import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
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
            .setNameLocalization('nl', 'kanaal')
            .setDescription('YouTube channel ID, handle, URL, or username')
            .setDescriptionLocalization('nl', 'YouTube-kanaal-ID, handle, URL of gebruikersnaam')
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
    const author = getXmlTag(authorBlock, 'name') ?? (resolveLocaleValue(locale, { en: 'Unknown channel', nl: 'Onbekend kanaal' }));
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
        await interaction.reply(resolveLocaleValue(locale, { en: `Could not resolve YouTube channel \`${input}\`.`, nl: `YouTube-kanaal \`${input}\` kon niet worden gevonden.` }));
        return;
    }
    if (!channelId) {
        await interaction.reply(resolveLocaleValue(locale, { en: `Could not resolve YouTube channel \`${input}\`.`, nl: `YouTube-kanaal \`${input}\` kon niet worden gevonden.` }));
        return;
    }

    let response: Response;
    try {
        response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
    } catch {
        await interaction.reply(resolveLocaleValue(locale, { en: `Could not fetch YouTube feed for \`${input}\`.`, nl: `De YouTube-feed voor \`${input}\` kon niet worden opgehaald.` }));
        return;
    }

    if (!response.ok) {
        await interaction.reply(resolveLocaleValue(locale, { en: `Could not fetch YouTube feed for \`${input}\`.`, nl: `De YouTube-feed voor \`${input}\` kon niet worden opgehaald.` }));
        return;
    }

    const latest = parseLatestVideo(await response.text(), locale);
    if (!latest) {
        await interaction.reply(resolveLocaleValue(locale, { en: `No videos found for \`${input}\`.`, nl: `Geen video's gevonden voor \`${input}\`.` }));
        return;
    }

    const published = latest.published
        ? `\n${resolveLocaleValue(locale, { en: 'Published', nl: 'Gepubliceerd' })} <t:${Math.floor(Date.parse(latest.published) / 1000)}:R>`
        : '';
    await interaction.reply(resolveLocaleValue(locale, { en: `Latest video from ${latest.author}: **${latest.title}**${published}\nhttps://www.youtube.com/watch?v=${latest.id}`, nl: `Nieuwste video van ${latest.author}: **${latest.title}**${published}\nhttps://www.youtube.com/watch?v=${latest.id}` }));
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
