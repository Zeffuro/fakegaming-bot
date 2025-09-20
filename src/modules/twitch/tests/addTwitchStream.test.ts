import {jest} from '@jest/globals';
import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {MockInteraction} from '../../../test/MockInteraction.js';
import {PermissionFlagsBits} from 'discord.js';
import {TwitchManager} from "../../../config/twitchManager.js";

describe('addTwitchStream command', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('adds a Twitch stream and replies with confirmation', async () => {
        const {command, mockManager} = await setupCommandTest({
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
        });

        mockManager.getAll.mockReturnValue([]);

        const interaction = new MockInteraction({
            stringOptions: {username: 'twitchuser', message: 'Go live!'},
            channelOptions: {channel: {id: '4167801562951251571'}},
            guildId: '135381928284343204',
        });
        interaction.memberPermissions = {
            has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
        };

        await command.execute(interaction as any);

        expect(mockManager.add).toHaveBeenCalledWith(
            expect.objectContaining({
                twitchUsername: 'twitchuser',
                discordChannelId: '4167801562951251571',
                customMessage: 'Go live!',
            })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Twitch stream `twitchuser` added for notifications')
        );
    });

    it('replies with error if Twitch stream already exists', async () => {
        const {command, mockManager} = await setupCommandTest({
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
        });

        mockManager.getAll.mockReturnValue([
            {twitchUsername: 'twitchuser', discordChannelId: '4167801562951251571'}
        ]);

        const interaction = new MockInteraction({
            stringOptions: {username: 'twitchuser'},
            channelOptions: {channel: {id: '4167801562951251571'}},
            guildId: '135381928284343204',
        });
        interaction.memberPermissions = {
            has: (perm: bigint) => perm === PermissionFlagsBits.Administrator,
        };

        await command.execute(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('already configured for notifications'),
            })
        );
    });

    it('replies with error if Twitch user does not exist', async () => {
        const {command, mockManager} = await setupCommandTest({
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
        });

        mockManager.getAll.mockReturnValue([]);

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
});