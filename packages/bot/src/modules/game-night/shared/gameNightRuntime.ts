import type { Client } from 'discord.js';
import { getConfigManager, type GameNightBoard } from '@zeffuro/fakegaming-common/managers';
import { getLogger } from '@zeffuro/fakegaming-common';
import { renderGameNightBoard } from './gameNightPresentation.js';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import { resolveOutputLocale } from '../../../core/localization.js';

const log = getLogger({ name: 'bot:game-night' });
const timers = new Map<string, NodeJS.Timeout>();
const refreshTimers = new Map<string, NodeJS.Timeout>();

export async function startGameNightExpiryRuntime(client: Client): Promise<void> {
    const boards = await getConfigManager().gameNightManager.listActive();
    for (const board of boards) {
        if (board.session.state === 'expired') await refreshGameNightMessage(client, board);
        else scheduleGameNightExpiry(client, board);
    }
}

export function scheduleGameNightExpiry(client: Client, board: GameNightBoard): void {
    cancelGameNightExpiry(board.session.id);
    if (board.session.state === 'finished' || board.session.state === 'expired') return;
    const delay = Math.max(0, board.session.expiresAt - Date.now());
    const timer = setTimeout(() => {
        timers.delete(board.session.id);
        void expireAndRefresh(client, board.session.id);
    }, Math.min(delay, 2_147_483_647));
    timer.unref();
    timers.set(board.session.id, timer);
}

export function cancelGameNightExpiry(sessionId: string): void {
    const timer = timers.get(sessionId);
    if (timer) clearTimeout(timer);
    timers.delete(sessionId);
}

export function queueGameNightRefresh(client: Client, board: GameNightBoard, delayMs = 750): void {
    cancelGameNightRefresh(board.session.id);
    const timer = setTimeout(() => {
        refreshTimers.delete(board.session.id);
        void refreshGameNightMessage(client, board).catch(error => {
            log.warn({ err: error, sessionId: board.session.id }, 'Failed to refresh a Game Night Board');
        });
    }, delayMs);
    timer.unref();
    refreshTimers.set(board.session.id, timer);
}

export function cancelGameNightRefresh(sessionId: string): void {
    const timer = refreshTimers.get(sessionId);
    if (timer) clearTimeout(timer);
    refreshTimers.delete(sessionId);
}

export async function refreshGameNightMessage(
    client: Client,
    board: GameNightBoard,
    locale?: SupportedOutputLocale,
): Promise<void> {
    if (!board.session.messageId) return;
    const channel = await client.channels.fetch(board.session.channelId);
    if (!channel?.isTextBased() || !('messages' in channel)) return;
    const outputLocale = locale ?? resolveOutputLocale(
        await getConfigManager().guildLocaleConfigManager.getOutputLocale(board.session.guildId),
    );
    await channel.messages.edit(board.session.messageId, renderGameNightBoard(board, outputLocale));
}

async function expireAndRefresh(client: Client, sessionId: string): Promise<void> {
    try {
        cancelGameNightRefresh(sessionId);
        const board = await getConfigManager().gameNightManager.expire(sessionId);
        await refreshGameNightMessage(client, board);
    } catch (error) {
        log.warn({ err: error, sessionId }, 'Failed to expire or refresh a Game Night Board');
    }
}
