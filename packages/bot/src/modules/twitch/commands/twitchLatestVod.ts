import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { twitchLatestVod as META } from '../commands.manifest.js';

interface TwitchUser {
    id: string;
    login: string;
    display_name?: string;
}

interface TwitchVideo {
    id: string;
    title?: string;
    url?: string;
    duration?: string;
    created_at?: string;
    published_at?: string;
}

const data = createSlashCommand(META, (builder: SlashCommandBuilder) =>
    builder.addStringOption(option =>
        option
            .setName('username')
            .setDescription('Twitch username')
            .setRequired(true)
    )
);

let appToken: { token: string; expiresAt: number } | null = null;

async function getTwitchAppToken(nowMs = Date.now()): Promise<string> {
    const clientId = process.env.TWITCH_CLIENT_ID ?? '';
    const clientSecret = process.env.TWITCH_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
        throw new Error('Twitch credentials are not configured.');
    }

    if (appToken && appToken.expiresAt - nowMs > 60_000) {
        return appToken.token;
    }

    const url = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to authenticate with Twitch.');
    const data = await response.json() as { access_token: string; expires_in?: number };
    appToken = { token: data.access_token, expiresAt: nowMs + (data.expires_in ?? 3600) * 1000 };
    return data.access_token;
}

async function twitchGet<T>(path: string, token: string): Promise<T | null> {
    const clientId = process.env.TWITCH_CLIENT_ID ?? '';
    const response = await fetch(`https://api.twitch.tv/helix/${path}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Client-Id': clientId,
        },
    });
    if (!response.ok) return null;
    return await response.json() as T;
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const username = interaction.options.getString('username', true).trim().replace(/^@/, '').toLowerCase();

    try {
        const token = await getTwitchAppToken();
        const users = await twitchGet<{ data: TwitchUser[] }>(`users?login=${encodeURIComponent(username)}`, token);
        const user = users?.data?.[0];
        if (!user) {
            await interaction.reply(`Twitch channel \`${username}\` was not found.`);
            return;
        }

        const videos = await twitchGet<{ data: TwitchVideo[] }>(`videos?user_id=${encodeURIComponent(user.id)}&type=archive&first=1`, token);
        const video = videos?.data?.[0];
        const displayName = user.display_name ?? user.login;
        if (!video) {
            await interaction.reply(`${displayName} does not have an archive VOD available right now. https://twitch.tv/${user.login}`);
            return;
        }

        const url = video.url || `https://www.twitch.tv/videos/${video.id}`;
        const publishedAt = video.published_at || video.created_at;
        const publishedText = publishedAt ? `\nPublished <t:${Math.floor(Date.parse(publishedAt) / 1000)}:R>` : '';
        const durationText = video.duration ? ` (${video.duration})` : '';
        await interaction.reply(`Latest VOD from ${displayName}: **${video.title ?? 'Untitled VOD'}**${durationText}${publishedText}\n${url}`);
    } catch (error) {
        await interaction.reply(error instanceof Error ? error.message : 'Failed to fetch the latest Twitch VOD.');
    }
}

const testOnly = getTestOnly(META);

export default { data, execute, testOnly };
