import type { ButtonInteraction } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import {
    COMPONENT_ROUTE_DEFINITIONS,
    ComponentRouter,
    componentNamespace,
    type ComponentRouteDefinition,
} from '../componentRouter.js';
import type { LoadedCommand } from '../FakegamingBot.js';

function command(handleComponent?: LoadedCommand['handleComponent']): LoadedCommand {
    return {
        data: { name: 'test' },
        execute: async () => undefined,
        handleComponent,
    };
}

function button(customId: string): ButtonInteraction {
    return { customId } as ButtonInteraction;
}

describe('ComponentRouter', () => {
    it('dispatches only the handler registered for the component namespace', async () => {
        const animeHandler = vi.fn(async () => true);
        const commands = new Map<string, LoadedCommand>([
            ['anime', command(animeHandler)],
        ]);
        const router = new ComponentRouter(commands, [{ namespace: 'anime', commandName: 'anime' }]);

        await expect(router.dispatch(button('anime:subscribe:42'))).resolves.toBe(true);
        expect(animeHandler).toHaveBeenCalledTimes(1);
    });

    it('registers poll as an explicit component namespace', async () => {
        const animeHandler = vi.fn(async () => true);
        const pollHandler = vi.fn(async () => true);
        const questionHandler = vi.fn(async () => true);
        const gameNightHandler = vi.fn(async () => true);
        const router = new ComponentRouter(new Map([
            ['anime', command(animeHandler)],
            ['poll', command(pollHandler)],
            ['question', command(questionHandler)],
            ['game-night', command(gameNightHandler)],
        ]));

        expect(COMPONENT_ROUTE_DEFINITIONS).toContainEqual({ namespace: 'poll', commandName: 'poll' });
        expect(COMPONENT_ROUTE_DEFINITIONS).toContainEqual({ namespace: 'question', commandName: 'question' });
        expect(COMPONENT_ROUTE_DEFINITIONS).toContainEqual({ namespace: 'game-night', commandName: 'game-night' });
        await expect(router.dispatch(button('poll:vote:session:0'))).resolves.toBe(true);
        expect(pollHandler).toHaveBeenCalledTimes(1);
        expect(animeHandler).not.toHaveBeenCalled();
        expect(questionHandler).not.toHaveBeenCalled();
    });

    it('keeps unknown component behavior as unhandled', async () => {
        const animeHandler = vi.fn(async () => true);
        const router = new ComponentRouter(
            new Map([['anime', command(animeHandler)]]),
            [{ namespace: 'anime', commandName: 'anime' }],
        );

        await expect(router.dispatch(button('unknown:action'))).resolves.toBe(false);
        expect(animeHandler).not.toHaveBeenCalled();
    });

    it('returns a registered handler result without changing its behavior', async () => {
        const animeHandler = vi.fn(async () => false);
        const router = new ComponentRouter(
            new Map([['anime', command(animeHandler)]]),
            [{ namespace: 'anime', commandName: 'anime' }],
        );

        await expect(router.dispatch(button('anime:unknown'))).resolves.toBe(false);
        expect(animeHandler).toHaveBeenCalledWith(expect.objectContaining({ customId: 'anime:unknown' }));
    });

    it('rejects duplicate namespaces during startup', () => {
        const commands = new Map([['anime', command(async () => true)]]);
        const definitions: ComponentRouteDefinition[] = [
            { namespace: 'anime', commandName: 'anime' },
            { namespace: 'anime', commandName: 'anime' },
        ];

        expect(() => new ComponentRouter(commands, definitions)).toThrow("Duplicate component namespace 'anime'.");
    });

    it('rejects component handlers without a registered namespace', () => {
        const commands = new Map([['anime', command(async () => true)]]);

        expect(() => new ComponentRouter(commands, [])).toThrow(
            "Command 'anime' has a component handler but no registered component namespace.",
        );
    });

    it('rejects a namespace registered for a command without a component handler', () => {
        const commands = new Map([['anime', command()]]);

        expect(() => new ComponentRouter(
            commands,
            [{ namespace: 'anime', commandName: 'anime' }],
        )).toThrow("Component namespace 'anime' is registered for command 'anime', which has no component handler.");
    });

    it('rejects a namespace registered for a missing command', () => {
        expect(() => new ComponentRouter(
            new Map(),
            [{ namespace: 'anime', commandName: 'anime' }],
        )).toThrow("Component namespace 'anime' is registered for missing command 'anime'.");
    });

    it('extracts the leading namespace from a custom id', () => {
        expect(componentNamespace('anime:season:airing')).toBe('anime');
        expect(componentNamespace('unscoped')).toBe('unscoped');
    });
});
