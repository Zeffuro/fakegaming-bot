import {jest} from '@jest/globals';
import {Regions} from 'twisted/dist/constants/regions.js';

describe('riotService', () => {
    it('getSummoner returns error on failure', async () => {
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
        const {getSummoner} = await import('../riotService.js');
        const result = await getSummoner('bad', Regions.EU_WEST);
        expect(result.success).toBe(false);
        expect(result.error).toBe('fail');
    });
});