import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

/**
 * Clear Discord send mock and return the mocked module for assertions.
 */
export async function prepareDiscord(): Promise<{ discord: any }>{
    const discord = await import('../../../utils/discord.js');
    (discord as any).sendChannelMessagePayload.mockClear?.();
    return { discord };
}

/**
 * Register a job and run its handler once, returning the queue and the done spy.
 */
export async function runJobOnce(eventName: string, register: (q: any, now: Date) => Promise<void>, now: Date = new Date('2025-01-01T00:00:00Z')): Promise<{ q: any; done: any }>{
    const q = new TestJobQueue();
    await register(q as any, now);
    const { done } = await runJobHandler(q, eventName, {});
    return { q, done };
}

