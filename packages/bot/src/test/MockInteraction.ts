import {jest} from '@jest/globals';
import type {UnknownFunction} from 'jest-mock';
import {ChannelType} from 'discord.js';
import type {Client, GuildTextBasedChannel, User} from 'discord.js';

export class MockInteraction {
    client: Client | undefined;
    options: {
        getString: jest.Mock;
        getUser: jest.Mock;
        getInteger: jest.Mock;
        getChannel: jest.Mock;
        getFocused: jest.Mock;
    };
    user: User;
    guildId: string;
    channel: GuildTextBasedChannel | null;
    reply: jest.Mock;
    responded: boolean = false;
    memberPermissions?: { has: (_perm: bigint) => boolean };

    constructor({
                    client,
                    stringOptions = {},
                    userOptions = {},
                    integerOptions = {},
                    channelOptions = {},
                    focused = "",
                    user = {id: "292685065920446469", tag: "RandomUser#1234"} as User,
                    guildId = "135381928284343204",
                    channel = {
                        id: "4167801562951251571",
                        type: ChannelType.GuildText,
                        send: jest.fn()
                    } as unknown as GuildTextBasedChannel,
                }: {
        client?: Client,
        stringOptions?: Record<string, string>,
        userOptions?: Record<string, User>,
        integerOptions?: Record<string, number>,
        channelOptions?: Record<string, GuildTextBasedChannel>,
        focused?: string,
        user?: User,
        guildId?: string,
        channel?: GuildTextBasedChannel,
    } = {}) {
        const castUserOptions: Record<string, User> = {};
        for (const key in userOptions) {
            castUserOptions[key] = userOptions[key] as unknown as User;
        }
        const castChannelOptions: Record<string, GuildTextBasedChannel> = {};
        for (const key in channelOptions) {
            castChannelOptions[key] = channelOptions[key] as unknown as GuildTextBasedChannel;
        }
        this.options = {
            getString: jest.fn(((name: string, _required?: boolean) => stringOptions[name]) as UnknownFunction),
            getUser: jest.fn(((name: string, _required?: boolean) => castUserOptions[name]) as UnknownFunction),
            getInteger: jest.fn(((name: string, _required?: boolean) => integerOptions[name]) as UnknownFunction),
            getChannel: jest.fn(((name: string, _required?: boolean) => castChannelOptions[name]) as UnknownFunction),
            getFocused: jest.fn((() => focused) as UnknownFunction),
        };
        this.user = user as unknown as User;
        this.guildId = guildId;
        this.channel = channel as unknown as GuildTextBasedChannel;
        this.reply = jest.fn((..._args) => {
            this.responded = true;
            return Promise.resolve();
        });
        this.responded = false;
        this.client = client;
    }

    deferReply(..._args: unknown[]) {
        this.responded = true;
        return Promise.resolve();
    }

    editReply(..._args: unknown[]) {
        this.responded = true;
        return Promise.resolve();
    }
}