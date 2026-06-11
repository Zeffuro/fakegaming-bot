import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {streamStatus as META} from '../commands.manifest.js';

interface TwitchUser {
    id: string;
    login: string;
    display_name?: string;
}

interface TwitchStream {
    title: string;
    viewer_count?: number;
    game_name?: string;
    started_at?: string;
}

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addStringOption(option =>
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
    const response = await fetch(url, {method: 'POST'});
    if (!response.ok) throw new Error('Failed to authenticate with Twitch.');
    const data = await response.json() as { access_token: string; expires_in?: number };
    appToken = {token: data.access_token, expiresAt: nowMs + (data.expires_in ?? 3600) * 1000};
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

async function execute(interaction: ChatInputCommandInteraction) {
    const username = interaction.options.getString('username', true).trim().replace(/^@/, '').toLowerCase();

    try {
        const token = await getTwitchAppToken();
        const users = await twitchGet<{ data: TwitchUser[] }>(`users?login=${encodeURIComponent(username)}`, token);
        const user = users?.data?.[0];
        if (!user) {
            await interaction.reply(`Twitch channel \`${username}\` was not found.`);
            return;
        }

        const streams = await twitchGet<{ data: TwitchStream[] }>(`streams?user_id=${encodeURIComponent(user.id)}`, token);
        const stream = streams?.data?.[0];
        const displayName = user.display_name ?? user.login;
        if (!stream) {
            await interaction.reply(`${displayName} is currently offline. https://twitch.tv/${user.login}`);
            return;
        }

        const startedAt = stream.started_at ? `<t:${Math.floor(Date.parse(stream.started_at) / 1000)}:R>` : 'recently';
        const game = stream.game_name ? ` playing **${stream.game_name}**` : '';
        const viewers = typeof stream.viewer_count === 'number' ? ` with **${stream.viewer_count}** viewers` : '';
        await interaction.reply(`${displayName} is live${game}${viewers}: **${stream.title}**\nStarted ${startedAt}\nhttps://twitch.tv/${user.login}`);
    } catch (error) {
        await interaction.reply(error instanceof Error ? error.message : 'Failed to check Twitch status.');
    }
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
