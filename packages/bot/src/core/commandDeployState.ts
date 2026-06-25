import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { stableStringify } from './commandDeployHash.js';
import type { CommandDeployState, CommandDeployStateEntry } from './commandDeployTypes.js';

interface LoggerLike {
    warn(value: Record<string, unknown>, message: string): void;
}

export async function readCommandDeployState(statePath: string, log?: LoggerLike): Promise<CommandDeployState> {
    try {
        const raw = await readFile(statePath, 'utf8');
        const parsed = JSON.parse(raw) as unknown;
        if (!isRecord(parsed)) return {};

        const deployments = isRecord(parsed.deployments)
            ? Object.fromEntries(
                Object.entries(parsed.deployments)
                    .filter((entry): entry is [string, CommandDeployStateEntry] => {
                        const value = entry[1];
                        return isRecord(value)
                            && typeof value.hash === 'string'
                            && typeof value.updatedAt === 'string';
                    })
            )
            : undefined;

        return deployments ? { deployments } : {};
    } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') return {};

        log?.warn({ err: error, statePath }, 'Failed to read command deployment state; rebuilding it after a successful check');
        return {};
    }
}

export async function writeCommandDeployState(statePath: string, state: CommandDeployState): Promise<void> {
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(statePath, `${stableStringify(state)}\n`, 'utf8');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
}
