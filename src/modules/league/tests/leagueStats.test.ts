import {runLeagueTest} from './sharedLeagueTest.js';

describe('leagueStats command', () => {
    it('replies with stats embed', async () => {
        await runLeagueTest('../../modules/league/commands/leagueStats.js', {embeds: expect.any(Array)});
    });
});