import {
    AutocompleteInteraction,
    ButtonInteraction,
    ChatInputCommandInteraction,
    Client,
    ClientOptions,
    Collection,
    MessageContextMenuCommandInteraction,
    UserContextMenuCommandInteraction,
} from 'discord.js';

export type ExecutableCommandInteraction =
    | ChatInputCommandInteraction
    | UserContextMenuCommandInteraction
    | MessageContextMenuCommandInteraction;

export interface LoadedCommandData {
    name: string;
    description?: string;
    toJSON?: () => Record<string, unknown>;
}

export interface LoadedCommand {
    data: LoadedCommandData;
    description?: string;
    execute: (interaction: ExecutableCommandInteraction) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
    handleComponent?: (interaction: ButtonInteraction) => Promise<boolean>;
    moduleName?: string;
}

export class FakegamingBot extends Client {
    commands: Collection<string, LoadedCommand>;

    constructor(options: ClientOptions) {
        super(options);
        this.commands = new Collection();
    }
}
