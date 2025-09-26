import {jest} from '@jest/globals';
import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {
    CommandInteraction,
    GuildTextBasedChannel,
    PermissionFlagsBits,
} from 'discord.js';
import {YoutubeManager} from '@zeffuro/fakegaming-common/dist/managers/youtubeManager.js';
import {YoutubeVideoConfig} from '@zeffuro/fakegaming-common';

describe('addYoutubeVideoChannel command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('adds a YouTube channel and replies with confirmation', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: YoutubeManager, // YoutubeManager is mocked via configManager
            managerKey: 'youtubeManager',
            commandPath: '../../modules/youtube/commands/addYoutubeVideoChannel.js',
            mocks: [
                {
                    module: '../../services/youtubeService.js',
                    factory: () => ({
                        getYoutubeChannelId: jest.fn(() =>
                            Promise.resolve('UC1234567890abcdef'),
                        ),
                    }),
                },
            ],
            interactionOptions: {
                stringOptions: {username: 'youtubeuser', message: 'New video!'},
                channelOptions: {
                    channel: {id: '4167801562951251571'} as GuildTextBasedChannel,
                },
                guildId: '135381928284343204',
                memberPermissions: {
                    has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
                },
            }
        });

        const getVideoChannelMock = mockManager
            .getVideoChannel as jest.MockedFunction<
            (youtubeChannelId: string) => Promise<YoutubeVideoConfig | undefined>
        >;

        getVideoChannelMock.mockResolvedValue(undefined);

        await command.execute(interaction as unknown as CommandInteraction);

        expect(mockManager.add).toHaveBeenCalledWith(
            expect.objectContaining({
                youtubeChannelId: 'UC1234567890abcdef',
                discordChannelId: '4167801562951251571',
                customMessage: 'New video!',
            }),
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining(
                'Youtube channel `youtubeuser` added for video notifications',
            ),
        );
    });

    it('replies with error if YouTube channel does not exist', async () => {
        const {command, interaction} = await setupCommandWithInteraction({
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
            interactionOptions: {
                stringOptions: {username: 'missinguser'},
                channelOptions: {
                    channel: {id: '4167801562951251571'} as GuildTextBasedChannel,
                },
                guildId: '135381928284343204',
                memberPermissions: {
                    has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
                },
            }
        });

        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('does not exist'),
            }),
        );
    });

    it('replies with error if channel already configured', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
            managerClass: YoutubeManager,
            managerKey: 'youtubeManager',
            commandPath: '../../modules/youtube/commands/addYoutubeVideoChannel.js',
            mocks: [
                {
                    module: '../../services/youtubeService.js',
                    factory: () => ({
                        getYoutubeChannelId: jest.fn(() =>
                            Promise.resolve('UC1234567890abcdef'),
                        ),
                    }),
                },
            ],
            interactionOptions: {
                stringOptions: {username: 'youtubeuser'},
                channelOptions: {
                    channel: {id: '4167801562951251571'} as GuildTextBasedChannel,
                },
                guildId: '135381928284343204',
                memberPermissions: {
                    has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
                },
            }
        });

        const getVideoChannelMock = mockManager
            .getVideoChannel as jest.MockedFunction<
            (youtubeChannelId: string) => Promise<YoutubeVideoConfig | undefined>
        >;

        getVideoChannelMock.mockResolvedValue({
            youtubeChannelId: 'UC1234567890abcdef',
            discordChannelId: '4167801562951251571',
        } as unknown as YoutubeVideoConfig);

        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining(
                    'already configured for video notifications',
                ),
            }),
        );
    });
});
