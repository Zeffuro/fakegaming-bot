import {jest} from '@jest/globals';
import {setupCommandTest} from '../../../test/utils/commandTestHelper.js';
import {MockInteraction} from '../../../test/MockInteraction.js';
import {LeagueConfig} from '@zeffuro/fakegaming-common/dist/models/league-config.js';

jest.spyOn(LeagueConfig, 'create').mockResolvedValue({} as any);

describe('linkRiot command', () => {
    it('links Riot account and replies', async () => {
        const {command, mockManager} = await setupCommandTest({
            managerClass: class {
            },
            managerKey: 'userManager',
            commandPath: '../../modules/league/commands/linkRiot.js',
            mocks: [
                {
                    module: '../../modules/league/utils/leagueUtils.js',
                    factory: () => ({
                        getRegionCodeFromName: jest.fn().mockReturnValue('EUW')
                    })
                },
                {
                    module: '../../services/riotService.js',
                    factory: () => ({
                        resolveLeagueIdentity: jest.fn((_options: any) => Promise.resolve({
                            summoner: 'Zeffuro',
                            region: 'EUW',
                            puuid: 'oDOOxyCaz72A-bXvUTbVrSasRENrwtVVELN3zILCqgXSY8n8RW_EIMrPY7kh8UTnRb1Xah41jy9VwQ'
                        }))
                    })
                }
            ]
        });

        mockManager.getUser = jest.fn().mockReturnValue(undefined);
        mockManager.add = jest.fn();
        mockManager.getUserWithLeague = jest.fn(() => Promise.resolve(null));

        const interaction = new MockInteraction({
            stringOptions: {'riot-id': 'Zeffuro#EUW', region: 'EUW'},
            userOptions: {},
        });
        interaction.deferReply = jest.fn(() => Promise.resolve());
        interaction.editReply = jest.fn(() => Promise.resolve());

        await command.execute(interaction as any);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.stringContaining('Linked <@292685065920446469> to Riot ID: Zeffuro [EUW]')
        );
    });
});