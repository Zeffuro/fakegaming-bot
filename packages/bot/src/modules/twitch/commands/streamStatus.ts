import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {createSlashCommand, getTestOnly} from '../../../core/commandBuilder.js';
import {streamStatus as META} from '../commands.manifest.js';
import {resolveInteractionOutputLocale, type SupportedOutputLocale} from '../../../core/localization.js';

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
            .setNameLocalization('nl', 'gebruikersnaam')
            .setDescription('Twitch username')
            .setDescriptionLocalization('nl', 'Twitch-gebruikersnaam')
            .setRequired(true)
    )
);

let appToken: { token: string; expiresAt: number } | null = null;

class TwitchStatusError extends Error {}

async function getTwitchAppToken(locale: SupportedOutputLocale, nowMs = Date.now()): Promise<string> {
    const clientId = process.env.TWITCH_CLIENT_ID ?? '';
    const clientSecret = process.env.TWITCH_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
        throw new TwitchStatusError(resolveLocaleValue(locale, { en: 'Twitch credentials are not configured.', nl: 'Twitch-inloggegevens zijn niet ingesteld.' }));
    }

    if (appToken && appToken.expiresAt - nowMs > 60_000) {
        return appToken.token;
    }

    const url = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;
    const response = await fetch(url, {method: 'POST'});
    if (!response.ok) throw new TwitchStatusError(resolveLocaleValue(locale, { en: 'Failed to authenticate with Twitch.', nl: 'Authenticatie bij Twitch is mislukt.' }));
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

        const streams = await twitchGet<{ data: TwitchStream[] }>(`streams?user_id=${encodeURIComponent(user.id)}`, token);
        const stream = streams?.data?.[0];
        const displayName = user.display_name ?? user.login;
        if (!stream) {
            await interaction.reply(resolveLocaleValue(locale, { en: `${displayName} is currently offline. https://twitch.tv/${user.login}`, nl: `${displayName} is momenteel offline. https://twitch.tv/${user.login}` }));
            return;
        }

        const startedAt = stream.started_at ? `<t:${Math.floor(Date.parse(stream.started_at) / 1000)}:R>` : resolveLocaleValue(locale, { en: 'recently', nl: 'onlangs' });
        const game = stream.game_name ? resolveLocaleValue(locale, { en: ` playing **${stream.game_name}**`, nl: ` en speelt **${stream.game_name}**` }) : '';
        const viewers = typeof stream.viewer_count === 'number'
            ? resolveLocaleValue(locale, { en: ` with **${stream.viewer_count}** viewers`, nl: ` met **${stream.viewer_count}** kijkers` })
            : '';
        await interaction.reply(resolveLocaleValue(locale, { en: `${displayName} is live${game}${viewers}: **${stream.title}**\nStarted ${startedAt}\nhttps://twitch.tv/${user.login}`, nl: `${displayName} is live${game}${viewers}: **${stream.title}**\nGestart ${startedAt}\nhttps://twitch.tv/${user.login}` }));
    } catch (error) {
        await interaction.reply(error instanceof TwitchStatusError
            ? error.message
            : resolveLocaleValue(locale, { en: 'Failed to check Twitch status.', nl: 'Twitch-status controleren is mislukt.' }));
    }
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
