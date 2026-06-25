import { createHash } from 'node:crypto';

const volatileCommandKeys = new Set(['id', 'application_id', 'version', 'guild_id']);

export function hashCommands(commands: object[]): string {
    return createHash('sha256')
        .update(stableStringify(normalizeCommands(commands)))
        .digest('hex');
}

export function commandsAreDifferent(existing: object[], local: object[]): boolean {
    return stableStringify(normalizeCommands(existing)) !== stableStringify(normalizeCommands(local));
}

export function normalizeResponseCommands(value: unknown): object[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is object => isRecord(item));
}

export function findDuplicateNames(commands: object[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const command of commands) {
        const name = getCommandName(command);
        if (!name) continue;
        if (seen.has(name)) duplicates.add(name);
        seen.add(name);
    }
    return [...duplicates].sort((left, right) => left.localeCompare(right));
}

export function stableStringify(value: unknown): string {
    return JSON.stringify(stabilizeValue(value));
}

function normalizeCommands(commands: object[]): Record<string, unknown>[] {
    return [...commands]
        .map((command) => normalizeCommand(command))
        .sort((left, right) => getCommandName(left).localeCompare(getCommandName(right)));
}

function normalizeCommand(command: object): Record<string, unknown> {
    const raw = command as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
        if (!volatileCommandKeys.has(key)) {
            normalized[key] = value;
        }
    }
    if (!('type' in normalized)) {
        normalized.type = 1;
    }
    return normalized;
}

function stabilizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(item => stabilizeValue(item));
    }
    if (isRecord(value)) {
        return Object.fromEntries(
            Object.entries(value)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, stabilizeValue(item)])
        );
    }
    return value;
}

function getCommandName(command: object): string {
    const value = (command as Record<string, unknown>).name;
    return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
