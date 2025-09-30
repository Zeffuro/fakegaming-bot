import {jest} from '@jest/globals';
import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {CommandInteraction, GuildTextBasedChannel, PermissionFlagsBits} from 'discord.js';
import {TwitchManager} from "@zeffuro/fakegaming-common/dist/managers/twitchManager.js";

describe('addTwitchStream command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('adds a Twitch stream and replies with confirmation', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: TwitchManager, // TwitchManager is mocked via configManager
            managerKey: 'twitchManager',
            commandPath: '../../modules/twitch/commands/addTwitchStream.js',
            mocks: [
                {
                    module: '../../services/twitchService.js',
                    factory: () => ({
                        verifyTwitchUser: jest.fn(() => Promise.resolve(true)),
                    }),
                },
            ],
            interactionOptions: {
                stringOptions: {username: 'twitchuser', message: 'Go live!'},
                channelOptions: {channel: {id: '4167801562951251571'} as unknown as GuildTextBasedChannel},
                guildId: '135381928284343204',
                memberPermissions: {
                    has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
                },
            }
        });

        mockManager.getAll.mockReturnValue([]);

        await command.execute(interaction as unknown as CommandInteraction);

        expect(mockManager.add).toHaveBeenCalledWith(
            expect.objectContaining({
                twitchUsername: 'twitchuser',
                discordChannelId: '4167801562951251571',
                guildId: '135381928284343204',
                customMessage: 'Go live!',
            })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Twitch stream `twitchuser` added for notifications')
        );
    });

    it('replies with error if Twitch stream already exists', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: TwitchManager,
            managerKey: 'twitchManager',
            commandPath: '../../modules/twitch/commands/addTwitchStream.js',
            mocks: [
                {
                    module: '../../services/twitchService.js',
                    factory: () => ({
                        verifyTwitchUser: jest.fn(() => Promise.resolve(true)),
                    }),
                },
            ],
            interactionOptions: {
                stringOptions: {username: 'twitchuser'},
                channelOptions: {channel: {id: '4167801562951251571'} as unknown as GuildTextBasedChannel},
                guildId: '135381928284343204',
                memberPermissions: {
                    has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
                },
            }
        });

        // Mock exists to return true
        mockManager.streamExists = jest.fn(() => Promise.resolve(true));

        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('already configured for notifications'),
            })
        );
    });

    it('replies with error if Twitch user does not exist', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: TwitchManager,
            managerKey: 'twitchManager',
            commandPath: '../../modules/twitch/commands/addTwitchStream.js',
            mocks: [
                {
                    module: '../../services/twitchService.js',
                    factory: () => ({
                        verifyTwitchUser: jest.fn(() => Promise.resolve(false)),
                    }),
                },
            ],
            interactionOptions: {
                stringOptions: {username: 'missinguser'},
                channelOptions: {channel: {id: '4167801562951251571'} as unknown as GuildTextBasedChannel},
                guildId: '135381928284343204',
                memberPermissions: {
                    has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
                },
            }
        });

        mockManager.getAll.mockReturnValue([]);

        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('does not exist'),
            })
        );
    });
});