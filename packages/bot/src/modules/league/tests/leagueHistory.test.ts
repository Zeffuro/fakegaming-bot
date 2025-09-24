import {runLeagueTest} from './sharedLeagueTest.js';

describe('leagueHistory command', () => {
    it('replies with match history image', async () => {
        await runLeagueTest('../../modules/league/commands/leagueHistory.js', {files: expect.any(Array)});
    });
});