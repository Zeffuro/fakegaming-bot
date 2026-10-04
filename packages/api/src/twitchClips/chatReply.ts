import { getLogger, type SupportedOutputLocale } from '@zeffuro/fakegaming-common';
import { TwitchClipConfig, TwitchClipRequest } from '@zeffuro/fakegaming-common/models';
import { apiText, resolveGuildOutputLocale } from '../localization/locale.js';
import { getTwitchClipBotToken } from './botAuth.js';
import { sendTwitchClipChatMessage } from './helix.js';

const log = getLogger({ name: 'api:twitch-clip-replies' });
const recentAttempts: { at: number; broadcasterId: string }[] = [];
type ReplyOutcome = { url: string } | { errorCode: string };

export function buildTwitchClipReply(
    config: Pick<TwitchClipConfig, 'replyTemplate' | 'twitchUsername'>,
    triggerName: string,
    outcome: ReplyOutcome,
    locale: SupportedOutputLocale,
): string {
    const user = Array.from(triggerName.replace(/\s+/g, '')).filter(character => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
    }).slice(0, 25).join('');
    if ('errorCode' in outcome) {
        const key = outcome.errorCode === 'twitch_http_404' ? 'twitchClipReplyOffline' : 'twitchClipReplyFailed';
        return apiText(locale, key, { user });
    }
    const fallback = apiText(locale, 'twitchClipReplyCreated', { user, url: outcome.url });
    const template = config.replyTemplate?.trim();
    if (!template) return fallback;
    const values = { url: outcome.url, user, channel: config.twitchUsername };
    const rendered = template.replace(/\{(url|user|channel)\}/g, (_token, key: keyof typeof values) => values[key]);
    // Preserve a complete clip URL if expanded user text exceeds Twitch's limit.
    return Array.from(rendered).length <= 500 ? rendered : fallback;
}

export async function replyToTwitchClipRequest(
    request: TwitchClipRequest,
    configs: TwitchClipConfig[],
    outcome: ReplyOutcome,
): Promise<void> {
    const config = configs.filter(item => item.replyEnabled).sort((a, b) => a.id.localeCompare(b.id))[0];
    if (!config || request.replyAttemptedAt || Date.now() - new Date(request.requestedAt).getTime() > 120_000) return;
    try {
        const token = await getTwitchClipBotToken();
        if (!token.chatReplyAuthorized) return;
        const locale = await resolveGuildOutputLocale(config.guildId);
        const message = buildTwitchClipReply(config, request.triggerName, outcome, locale);
        const now = Date.now();
        const [claimed] = await TwitchClipRequest.update({ replyAttemptedAt: new Date(now) }, {
            where: { id: request.id, replyAttemptedAt: null },
        });
        if (claimed !== 1) return;
        request.replyAttemptedAt = new Date(now);
        const sendAt = Date.now();
        while (recentAttempts.length && recentAttempts[0].at <= sendAt - 30_000) recentAttempts.shift();
        if (recentAttempts.length >= 20 || recentAttempts.some(item => item.broadcasterId === request.broadcasterId && sendAt - item.at < 1000)) {
            log.warn({ requestId: request.id }, 'Twitch clip reply skipped at chat rate limit');
            return;
        }
        recentAttempts.push({ at: sendAt, broadcasterId: request.broadcasterId });
        // Claim before the non-idempotent send; uncertain results are never replayed.
        await sendTwitchClipChatMessage(request.broadcasterId, request.id, message, token);
    } catch {
        log.warn({ requestId: request.id }, 'Twitch clip chat reply failed');
    }
}
