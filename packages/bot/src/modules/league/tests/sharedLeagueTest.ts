import {jest, expect} from '@jest/globals';
import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {MockInteraction} from '../../../test/MockInteraction.js';
import {UserManager} from "../../../../../common/src/managers/userManager.js";
import {mockLeagueUtils, mockRiotService, mockTierEmojis} from '../test/leagueMockFactories.js';

export async function runLeagueTest(commandPath: string, expected: any) {
    const {command} = await setupCommandTest({
        managerClass: UserManager,
        managerKey: 'dummy',
        commandPath,
        mocks: [
            {module: '../../modules/league/utils/leagueUtils.js', factory: () => mockLeagueUtils},
            {module: '../../services/riotService.js', factory: () => mockRiotService},
            {module: '../../modules/league/constants/leagueTierEmojis.js', factory: () => mockTierEmojis}
        ]
    });

    const interaction = new MockInteraction({});
    interaction.deferReply = jest.fn(() => Promise.resolve());
    interaction.editReply = jest.fn(() => Promise.resolve());

    await command.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining(expected)
    );
}