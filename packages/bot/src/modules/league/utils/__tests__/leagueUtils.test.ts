import { describe, it, expect, vi } from 'vitest';
import { getLeagueIdentityFromInteraction, getRegionCodeFromName } from '../leagueUtils.js';
import { ChatInputCommandInteraction } from 'discord.js';
import { Regions } from 'twisted/dist/constants/regions.js';
import * as riotService from '../../../../services/riotService.js';
import { createMockCommandInteraction } from '@zeffuro/fakegaming-common/testing';

vi.mock('../../../../services/riotService.js');

describe('leagueUtils', () => {
    describe('getRegionCodeFromName', () => {
        it('should return undefined for no input', () => {
            expect(getRegionCodeFromName(undefined)).toBeUndefined();
            expect(getRegionCodeFromName()).toBeUndefined();
        });

        it('should resolve region by name', () => {
            expect(getRegionCodeFromName('North America')).toBe(Regions.AMERICA_NORTH);
            expect(getRegionCodeFromName('Europe West')).toBe(Regions.EU_WEST);
            expect(getRegionCodeFromName('Korea')).toBe(Regions.KOREA);
        });

        it('should resolve region by value', () => {
            expect(getRegionCodeFromName(Regions.AMERICA_NORTH)).toBe(Regions.AMERICA_NORTH);
            expect(getRegionCodeFromName(Regions.EU_WEST)).toBe(Regions.EU_WEST);
            expect(getRegionCodeFromName(Regions.KOREA)).toBe(Regions.KOREA);
        });

        it('should return undefined for invalid region', () => {
            expect(getRegionCodeFromName('invalid')).toBeUndefined();
            expect(getRegionCodeFromName('unknown')).toBeUndefined();
        });
    });

    describe('getLeagueIdentityFromInteraction', () => {
        it('should resolve identity with riot-id option', async () => {
            const mockIdentity = { summonerName: 'TestPlayer', region: Regions.AMERICA_NORTH };
            vi.mocked(riotService.resolveLeagueIdentity).mockResolvedValue(mockIdentity as any);

            const interaction = createMockCommandInteraction({
                user: { id: 'user123' },
                stringOptions: {
                    'riot-id': 'Player#NA1',
                    'region': 'North America',
                },
                userOptions: {}
            });

            const result = await getLeagueIdentityFromInteraction(interaction as unknown as ChatInputCommandInteraction);

            expect(riotService.resolveLeagueIdentity).toHaveBeenCalledWith({
                summoner: 'Player#NA1',
                region: Regions.AMERICA_NORTH,
                userId: 'user123',
            });
            expect(result).toEqual(mockIdentity);
        });

        it('should resolve identity with summoner option', async () => {
            const mockIdentity = { summonerName: 'TestSummoner', region: Regions.EU_WEST };
            vi.mocked(riotService.resolveLeagueIdentity).mockResolvedValue(mockIdentity as any);

            const interaction = createMockCommandInteraction({
                user: { id: 'user456' },
                stringOptions: {
                    'summoner': 'TestSummoner',
                    'region': 'Europe West',
                },
                userOptions: {}
            });

            const result = await getLeagueIdentityFromInteraction(interaction as unknown as ChatInputCommandInteraction);

            expect(riotService.resolveLeagueIdentity).toHaveBeenCalledWith({
                summoner: 'TestSummoner',
                region: Regions.EU_WEST,
                userId: 'user456',
            });
            expect(result).toEqual(mockIdentity);
        });

        it('should use target user when user option is provided', async () => {
            const mockIdentity = { summonerName: 'TargetPlayer', region: Regions.KOREA };
            vi.mocked(riotService.resolveLeagueIdentity).mockResolvedValue(mockIdentity as any);

            const interaction = createMockCommandInteraction({
                user: { id: 'user123' },
                stringOptions: {},
                userOptions: { 'user': 'target789' },
            });

            const result = await getLeagueIdentityFromInteraction(interaction as unknown as ChatInputCommandInteraction);

            expect(riotService.resolveLeagueIdentity).toHaveBeenCalledWith({
                summoner: undefined,
                region: undefined,
                userId: 'target789',
            });
            expect(result).toEqual(mockIdentity);
        });

        it('should handle undefined values', async () => {
            const mockIdentity = { summonerName: 'DefaultPlayer', region: Regions.AMERICA_NORTH };
            vi.mocked(riotService.resolveLeagueIdentity).mockResolvedValue(mockIdentity as any);

            const interaction = createMockCommandInteraction({
                user: { id: 'user999' },
                stringOptions: {},
                userOptions: {},
            });

            const result = await getLeagueIdentityFromInteraction(interaction as unknown as ChatInputCommandInteraction);

            expect(riotService.resolveLeagueIdentity).toHaveBeenCalledWith({
                summoner: undefined,
                region: undefined,
                userId: 'user999',
            });
            expect(result).toEqual(mockIdentity);
        });
    });
});
