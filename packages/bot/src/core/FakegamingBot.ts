import {Client, Collection, CommandInteraction, AutocompleteInteraction, ButtonInteraction, ClientOptions} from 'discord.js';

export interface LoadedCommand {
    data: unknown;
    execute: (interaction: CommandInteraction) => Promise<void>;
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
