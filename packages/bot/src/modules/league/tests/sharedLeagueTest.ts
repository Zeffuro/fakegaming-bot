import {jest, expect} from '@jest/globals';
import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {UserManager} from "@zeffuro/fakegaming-common/managers";
import {mockLeagueUtils, mockRiotService, mockTierEmojis} from '../test/leagueMockFactories.js';
import {CommandInteraction} from "discord.js";

export async function runLeagueTest(commandPath: string, expected: Record<string, unknown>) {
    const {command, interaction} = await setupCommandWithInteraction({
        managerClass: UserManager,
        managerKey: 'dummy',
        commandPath,
        mocks: [
            {module: '../../modules/league/utils/leagueUtils.js', factory: () => mockLeagueUtils},
            {module: '../../services/riotService.js', factory: () => mockRiotService},
            {module: '../../modules/league/constants/leagueTierEmojis.js', factory: () => mockTierEmojis}
        ],
        interactionOptions: {
            deferReplyImpl: jest.fn(() => Promise.resolve()),
            editReplyImpl: jest.fn(() => Promise.resolve()),
        }
    });

    await command.execute(interaction as unknown as CommandInteraction);

    expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining(expected)
    );
}