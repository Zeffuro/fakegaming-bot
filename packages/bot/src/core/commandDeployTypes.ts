export type CommandDeployMode = 'auto' | 'always' | 'never';
export type CommandDeployScope = 'global' | 'guild' | 'both';
export type CommandDeployAction = 'skipped-unchanged' | 'skipped-disabled' | 'checked' | 'updated';

export interface CommandDeployConfig {
    mode: CommandDeployMode;
    scope: CommandDeployScope;
    clientId: string;
    guildId?: string;
}

export interface CommandSet {
    globalCommands: object[];
    guildCommands: object[];
}

export interface CommandDeployTargetResult {
    action: CommandDeployAction;
    hash: string;
    key: string;
    target: 'global' | 'guild';
}

export interface CommandDeployResult {
    mode: CommandDeployMode;
    scope: CommandDeployScope;
    statePath?: string;
    targets: CommandDeployTargetResult[];
}

export interface RestClient {
    get(route: string): Promise<unknown>;
    put(route: string, options: { body: object[] }): Promise<unknown>;
}

export interface CommandDeployOptions {
    commandSets?: CommandSet;
    env?: NodeJS.ProcessEnv;
    now?: () => Date;
    rest?: RestClient;
    statePath?: string;
}

export interface CommandDeployState {
    deployments?: Record<string, CommandDeployStateEntry>;
}

export interface CommandDeployStateEntry {
    hash: string;
    updatedAt: string;
}

export interface CommandDeployTarget {
    commands: object[];
    hash: string;
    key: string;
    route: string;
    target: 'global' | 'guild';
}
