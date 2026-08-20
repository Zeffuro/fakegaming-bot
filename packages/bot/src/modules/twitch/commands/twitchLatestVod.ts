import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { twitchLatestVod as META } from '../commands.manifest.js';
import { resolveInteractionOutputLocale, type SupportedOutputLocale } from '../../../core/localization.js';

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
            .setNameLocalization('nl', 'gebruikersnaam')
            .setDescription('Twitch username')
            .setDescriptionLocalization('nl', 'Twitch-gebruikersnaam')
            .setRequired(true)
    )
);

let appToken: { token: string; expiresAt: number } | null = null;

class TwitchVodError extends Error {}

async function getTwitchAppToken(locale: SupportedOutputLocale, nowMs = Date.now()): Promise<string> {
    const clientId = process.env.TWITCH_CLIENT_ID ?? '';
    const clientSecret = process.env.TWITCH_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
        throw new TwitchVodError(resolveLocaleValue(locale, { en: 'Twitch credentials are not configured.', nl: 'Twitch-inloggegevens zijn niet ingesteld.' }));
    }

    if (appToken && appToken.expiresAt - nowMs > 60_000) {
        return appToken.token;
    }

    const url = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) throw new TwitchVodError(resolveLocaleValue(locale, { en: 'Failed to authenticate with Twitch.', nl: 'Authenticatie bij Twitch is mislukt.' }));
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
    const locale = await resolveInteractionOutputLocale(interaction);
    const username = interaction.options.getString('username', true).trim().replace(/^@/, '').toLowerCase();

    try {
        const token = await getTwitchAppToken(locale);
        const users = await twitchGet<{ data: TwitchUser[] }>(`users?login=${encodeURIComponent(username)}`, token);
        const user = users?.data?.[0];
        if (!user) {
            await interaction.reply(resolveLocaleValue(locale, { en: `Twitch channel \`${username}\` was not found.`, nl: `Twitch-kanaal \`${username}\` is niet gevonden.` }));
            return;
        }

        const videos = await twitchGet<{ data: TwitchVideo[] }>(`videos?user_id=${encodeURIComponent(user.id)}&type=archive&first=1`, token);
        const video = videos?.data?.[0];
        const displayName = user.display_name ?? user.login;
        if (!video) {
            await interaction.reply(resolveLocaleValue(locale, { en: `${displayName} does not have an archive VOD available right now. https://twitch.tv/${user.login}`, nl: `${displayName} heeft momenteel geen archief-VOD beschikbaar. https://twitch.tv/${user.login}` }));
            return;
        }

        const url = video.url || `https://www.twitch.tv/videos/${video.id}`;
        const publishedAt = video.published_at || video.created_at;
        const publishedText = publishedAt
            ? `\n${resolveLocaleValue(locale, { en: 'Published', nl: 'Gepubliceerd' })} <t:${Math.floor(Date.parse(publishedAt) / 1000)}:R>`
            : '';
        const durationText = video.duration ? ` (${video.duration})` : '';
        await interaction.reply(resolveLocaleValue(locale, { en: `Latest VOD from ${displayName}: **${video.title ?? 'Untitled VOD'}**${durationText}${publishedText}\n${url}`, nl: `Nieuwste VOD van ${displayName}: **${video.title ?? 'Naamloze VOD'}**${durationText}${publishedText}\n${url}` }));
    } catch (error) {
        await interaction.reply(error instanceof TwitchVodError
            ? error.message
            : resolveLocaleValue(locale, { en: 'Failed to fetch the latest Twitch VOD.', nl: 'De nieuwste Twitch-VOD ophalen is mislukt.' }));
    }
}

const testOnly = getTestOnly(META);

export default { data, execute, testOnly };
