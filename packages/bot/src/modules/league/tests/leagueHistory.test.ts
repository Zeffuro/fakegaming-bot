import {jest} from '@jest/globals';
import {runLeagueTest} from './sharedLeagueTest.js';

jest.setTimeout(15000);

describe('leagueHistory command', () => {
    it('replies with match history image', async () => {
        await runLeagueTest('../../modules/league/commands/leagueHistory.js', {files: expect.any(Array)});
    });
});