import {jest} from '@jest/globals';
import {ChannelType} from 'discord.js';
import type {GuildTextBasedChannel, User} from 'discord.js';

export class MockInteraction {
    client: any;
    options: any;
    user: User;
    guildId: string;
    channel: GuildTextBasedChannel | null;
    reply: jest.Mock;
    responded: boolean = false;
    memberPermissions?: { has: (perm: bigint) => boolean };

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
        client?: any,
        stringOptions?: Record<string, string>,
        userOptions?: Record<string, any>,
        integerOptions?: Record<string, number>,
        channelOptions?: Record<string, any>,
        focused?: string,
        user?: any,
        guildId?: string,
        channel?: any,
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
            getString: jest.fn((name: string, required?: boolean) => stringOptions[name]),
            getUser: jest.fn((name: string, required?: boolean) => castUserOptions[name]),
            getInteger: jest.fn((name: string, required?: boolean) => integerOptions[name]),
            getChannel: jest.fn((name: string, required?: boolean) => castChannelOptions[name]),
            getFocused: jest.fn(() => focused),
        };
        this.user = user as unknown as User;
        this.guildId = guildId;
        this.channel = channel as unknown as GuildTextBasedChannel;
        this.reply = jest.fn((...args) => {
            this.responded = true;
            return Promise.resolve();
        });
        this.responded = false;
        this.client = client;
    }

    deferReply(...args: any[]) {
        this.responded = true;
        return Promise.resolve();
    }

    editReply(...args: any[]) {
        this.responded = true;
        return Promise.resolve();
    }
}