import {jest} from '@jest/globals';
import {Regions} from 'twisted/dist/constants/regions.js';

jest.unstable_mockModule('twisted', () => ({
    RiotApi: jest.fn(() => ({})),
    LolApi: jest.fn(() => ({
        Summoner: {
            getByPUUID: jest.fn(() => {
                throw new Error('fail');
            })
        }
    })),
    TftApi: jest.fn(() => ({})),
}));

describe('riotService', () => {
    let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
    });
    afterEach(() => {
        consoleErrorSpy.mockRestore();
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('getSummoner returns error on failure', async () => {
        const {getSummoner} = await import('../riotService.js');
        const result = await getSummoner('bad', Regions.EU_WEST);
        expect(result.success).toBe(false);
        expect(result.error).toBe('fail');
    });

    it('getSummoner returns valid data', async () => {
        jest.resetModules();
        jest.unstable_mockModule('twisted', () => ({
            RiotApi: jest.fn(() => ({})),
            LolApi: jest.fn(() => ({
                Summoner: {
                    getByPUUID: jest.fn(() => ({
                        name: 'Summoner',
                        puuid: 'puuid',
                        summonerLevel: 30
                    }))
                }
            })),
            TftApi: jest.fn(() => ({})),
        }));
        const {getSummoner} = await import('../riotService.js');
        const result = await getSummoner('good', Regions.EU_WEST);
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({name: 'Summoner', puuid: 'puuid', summonerLevel: 30});
    });

    it('getSummoner handles malformed data', async () => {
        jest.resetModules();
        jest.unstable_mockModule('twisted', () => ({
            RiotApi: jest.fn(() => ({})),
            LolApi: jest.fn(() => ({
                Summoner: {
                    getByPUUID: jest.fn(() => ({}))
                }
            })),
            TftApi: jest.fn(() => ({})),
        }));
        const {getSummoner} = await import('../riotService.js');
        const result = await getSummoner('malformed', Regions.EU_WEST);
        expect(result.success).toBe(false);
    });

    it('getSummoner handles not found', async () => {
        jest.resetModules();
        jest.unstable_mockModule('twisted', () => ({
            RiotApi: jest.fn(() => ({})),
            LolApi: jest.fn(() => ({
                Summoner: {
                    getByPUUID: jest.fn(() => {
                        throw new Error('not found');
                    })
                }
            })),
            TftApi: jest.fn(() => ({})),
        }));
        const {getSummoner} = await import('../riotService.js');
        const result = await getSummoner('notfound', Regions.EU_WEST);
        expect(result.success).toBe(false);
        expect(result.error).toBe('not found');
    });
});