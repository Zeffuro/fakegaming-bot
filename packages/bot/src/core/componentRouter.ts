import type { ButtonInteraction } from 'discord.js';
import type { LoadedCommand } from './FakegamingBot.js';

export interface ComponentRouteDefinition {
    namespace: string;
    commandName: string;
}

export type ComponentHandler = NonNullable<LoadedCommand['handleComponent']>;

// Keep component namespaces explicit so registrations can be checked at startup.
export const COMPONENT_ROUTE_DEFINITIONS: readonly ComponentRouteDefinition[] = [
    { namespace: 'anime', commandName: 'anime' },
    { namespace: 'poll', commandName: 'poll' },
    { namespace: 'question', commandName: 'question' },
    { namespace: 'game-night', commandName: 'night' },
];

export class ComponentRouter {
    private readonly handlers: ReadonlyMap<string, ComponentHandler>;

    public constructor(
        commands: ReadonlyMap<string, LoadedCommand>,
        definitions: readonly ComponentRouteDefinition[] = COMPONENT_ROUTE_DEFINITIONS,
    ) {
        const handlers = new Map<string, ComponentHandler>();
        const registeredCommandNames = new Set<string>();

        for (const definition of definitions) {
            validateDefinition(definition);
            if (handlers.has(definition.namespace)) {
                throw new Error(`Duplicate component namespace '${definition.namespace}'.`);
            }

            const command = commands.get(definition.commandName);
            if (!command) {
                throw new Error(
                    `Component namespace '${definition.namespace}' is registered for missing command '${definition.commandName}'.`,
                );
            }
            if (!command.handleComponent) {
                throw new Error(
                    `Component namespace '${definition.namespace}' is registered for command '${definition.commandName}', which has no component handler.`,
                );
            }

            handlers.set(definition.namespace, command.handleComponent);
            registeredCommandNames.add(definition.commandName);
        }

        for (const [commandName, command] of commands) {
            if (command.handleComponent && !registeredCommandNames.has(commandName)) {
                throw new Error(`Command '${commandName}' has a component handler but no registered component namespace.`);
            }
        }

        this.handlers = handlers;
    }

    public async dispatch(interaction: ButtonInteraction): Promise<boolean> {
        const handler = this.handlers.get(componentNamespace(interaction.customId));
        if (!handler) return false;
        return handler(interaction);
    }
}

export function componentNamespace(customId: string): string {
    return customId.split(':', 1)[0] ?? '';
}

function validateDefinition(definition: ComponentRouteDefinition): void {
    if (!/^[a-z0-9-]+$/.test(definition.namespace)) {
        throw new Error(`Invalid component namespace '${definition.namespace}'.`);
    }
    if (!definition.commandName) {
        throw new Error(`Component namespace '${definition.namespace}' has no command name.`);
    }
}
