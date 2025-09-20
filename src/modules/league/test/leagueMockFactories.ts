import {jest} from '@jest/globals';

export const mockLeagueUtils = {
    getLeagueIdentityFromInteraction: jest.fn((_options: any) => Promise.resolve({
        summoner: 'Zeffuro',
        region: 'EUW1',
        puuid: 'oDOOxyCaz72A-bXvUTbVrSasRENrwtVVELN3zILCqgXSY8n8RW_EIMrPY7kh8UTnRb1Xah41jy9VwQ'
    }))
};

export const mockRiotService = {
    getMatchHistory: jest.fn(() => Promise.resolve({
        success: true,
        data: ['match1', 'match2', 'match3', 'match4', 'match5']
    })),
    getMatchDetails: jest.fn((_matchId, _regionGroup) => Promise.resolve({
        success: true,
        data: {
            info: {
                participants: [
                    {
                        puuid: 'oDOOxyCaz72A-bXvUTbVrSasRENrwtVVELN3zILCqgXSY8n8RW_EIMrPY7kh8UTnRb1Xah41jy9VwQ',
                        win: true,
                        gameMode: 'CLASSIC',
                        championId: 157
                    }
                ]
            }
        }
    })),
    getSummoner: jest.fn((_puuid: any, _region: any) => Promise.resolve({
        success: true,
        data: {profileIconId: 123, summonerLevel: 42}
    })),
    getSummonerDetails: jest.fn((_puuid: any, _region: any) => Promise.resolve({
        success: true,
        data: [{
            tier: 'GOLD',
            rank: 'IV',
            leaguePoints: 50,
            wins: 10,
            losses: 5,
            queueType: 'RANKED_SOLO_5x5'
        }]
    }))
};

export const mockTierEmojis = {tierEmojis: {GOLD: '🥇'}};