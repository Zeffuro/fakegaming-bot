import {jest} from '@jest/globals';
import {setupCommandWithInteraction} from '../../../test/utils/commandTestHelper.js';
import {LeagueConfig} from '@zeffuro/fakegaming-common/models';
import {CommandInteraction} from "discord.js";

jest.spyOn(LeagueConfig, 'create').mockResolvedValue({} as Partial<LeagueConfig>);

describe('linkRiot command', () => {
    it('links Riot account and replies', async () => {
        const {command, mockManager, interaction} = await setupCommandWithInteraction({
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
                        resolveLeagueIdentity: jest.fn((_options: Record<string, unknown>) => Promise.resolve({
                            summoner: 'Zeffuro',
                            region: 'EUW',
                            puuid: 'oDOOxyCaz72A-bXvUTbVrSasRENrwtVVELN3zILCqgXSY8n8RW_EIMrPY7kh8UTnRb1Xah41jy9VwQ'
                        }))
                    })
                }
            ],
            interactionOptions: {
                stringOptions: {'riot-id': 'Zeffuro#EUW', region: 'EUW'},
                userOptions: {},
                deferReplyImpl: jest.fn(() => Promise.resolve()),
                editReplyImpl: jest.fn(() => Promise.resolve()),
            }
        });
        mockManager.getUser = jest.fn().mockReturnValue(undefined);
        mockManager.add = jest.fn();
        mockManager.getUserWithLeague = jest.fn(() => Promise.resolve(null));
        await command.execute(interaction as unknown as CommandInteraction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.stringContaining('Linked <@292685065920446469> to Riot ID: Zeffuro [EUW]')
        );
    });
});