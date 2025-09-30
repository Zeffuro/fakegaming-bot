import { exchangeCodeForToken, fetchDiscordUser, fetchDiscordGuilds, issueJwt, verifyJwt } from '@zeffuro/fakegaming-common/src/discord/auth';
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, JWT_SECRET } from '@/lib/env';
import { cacheSet } from '@zeffuro/fakegaming-common/src/cache';

export function getDiscordOAuthUrl() {
    return `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
}

export async function handleDiscordLogin(code: string) {
    const tokenData = await exchangeCodeForToken(code, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI);
    const accessToken = tokenData.access_token;
    const user = await fetchDiscordUser(accessToken);
    const guilds = await fetchDiscordGuilds(accessToken);
    await cacheSet(`user:${user.id}:guilds`, guilds, 10 * 60 * 1000);
    const jwtToken = issueJwt(user, guilds, JWT_SECRET);
    return { jwtToken, user, accessToken, guilds };
}

export { exchangeCodeForToken, fetchDiscordUser, fetchDiscordGuilds, issueJwt, verifyJwt };
