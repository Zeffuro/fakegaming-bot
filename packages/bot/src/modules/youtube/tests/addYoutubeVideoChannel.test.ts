import {jest} from '@jest/globals';
import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {MockInteraction} from '../../../test/MockInteraction.js';
import {GuildTextBasedChannel, PermissionFlagsBits} from 'discord.js';
import {YoutubeManager} from "../../../../../common/src/managers/youtubeManager.js";

describe('addYoutubeVideoChannel command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('adds a YouTube channel and replies with confirmation', async () => {
        const {command, mockManager} = await setupCommandTest({
            managerClass: YoutubeManager, // YoutubeManager is mocked via configManager
            managerKey: 'youtubeManager',
            commandPath: '../../modules/youtube/commands/addYoutubeVideoChannel.js',
            mocks: [
                {
                    module: '../../services/youtubeService.js',
                    factory: () => ({
                        getYoutubeChannelId: jest.fn(() => Promise.resolve('UC1234567890abcdef')),
                    }),
                },
            ],
        });

        mockManager.getVideoChannel.mockResolvedValue(undefined);

        const interaction = new MockInteraction({
            stringOptions: {username: 'youtubeuser', message: 'New video!'},
            channelOptions: {channel: {id: '4167801562951251571'} as GuildTextBasedChannel},
            guildId: '135381928284343204',
        });
        interaction.memberPermissions = {
            has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
        };

        await command.execute(interaction as any);

        expect(mockManager.add).toHaveBeenCalledWith(
            expect.objectContaining({
                youtubeChannelId: 'UC1234567890abcdef',
                discordChannelId: '4167801562951251571',
                customMessage: 'New video!',
            })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Youtube channel `youtubeuser` added for video notifications')
        );
    });

    it('replies with error if YouTube channel does not exist', async () => {
        const {command} = await setupCommandTest({
            managerClass: YoutubeManager,
            managerKey: 'youtubeManager',
            commandPath: '../../modules/youtube/commands/addYoutubeVideoChannel.js',
            mocks: [
                {
                    module: '../../services/youtubeService.js',
                    factory: () => ({
                        getYoutubeChannelId: jest.fn(() => Promise.resolve(null)),
                    }),
                },
            ],
        });

        const interaction = new MockInteraction({
            stringOptions: {username: 'missinguser'},
            channelOptions: {channel: {id: '4167801562951251571'}},
            guildId: '135381928284343204',
        });
        interaction.memberPermissions = {
            has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
        };

        await command.execute(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('does not exist'),
            })
        );
    });

    it('replies with error if channel already configured', async () => {
        const {command, mockManager} = await setupCommandTest({
            managerClass: YoutubeManager,
            managerKey: 'youtubeManager',
            commandPath: '../../modules/youtube/commands/addYoutubeVideoChannel.js',
            mocks: [
                {
                    module: '../../services/youtubeService.js',
                    factory: () => ({
                        getYoutubeChannelId: jest.fn(() => Promise.resolve('UC1234567890abcdef')),
                    }),
                },
            ],
        });

        mockManager.getVideoChannel.mockResolvedValue({
            youtubeChannelId: 'UC1234567890abcdef',
            discordChannelId: '4167801562951251571',
        });

        const interaction = new MockInteraction({
            stringOptions: {username: 'youtubeuser'},
            channelOptions: {channel: {id: '4167801562951251571'}},
            guildId: '135381928284343204',
        });
        interaction.memberPermissions = {
            has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
        };

        await command.execute(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('already configured for video notifications'),
            })
        );
    });
});