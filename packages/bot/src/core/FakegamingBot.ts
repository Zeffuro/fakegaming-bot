import {Client, Collection, CommandInteraction, AutocompleteInteraction, ClientOptions} from 'discord.js';

export class FakegamingBot extends Client {
    commands: Collection<string, {
        data: unknown;
        execute: (interaction: CommandInteraction) => Promise<void>;
        autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
        moduleName?: string;
    }>;

    constructor(options: ClientOptions) {
        super(options);
        this.commands = new Collection();
    }
}