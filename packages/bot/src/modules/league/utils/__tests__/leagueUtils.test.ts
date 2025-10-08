import { describe, it, expect, vi } from 'vitest';
import { getLeagueIdentityFromInteraction, getRegionCodeFromName } from '../leagueUtils.js';
import { ChatInputCommandInteraction } from 'discord.js';
import { Regions } from 'twisted/dist/constants/regions.js';
import * as riotService from '../../../../services/riotService.js';

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

            const interaction = {
                options: {
                    getString: vi.fn((key: string) => {
                        if (key === 'riot-id') return 'Player#NA1';
                        if (key === 'region') return 'North America';
                        return null;
                    }),
                    getUser: vi.fn().mockReturnValue(null),
                },
                user: { id: 'user123' },
            } as unknown as ChatInputCommandInteraction;

            const result = await getLeagueIdentityFromInteraction(interaction);

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

            const interaction = {
                options: {
                    getString: vi.fn((key: string) => {
                        if (key === 'summoner') return 'TestSummoner';
                        if (key === 'region') return 'Europe West';
                        return null;
                    }),
                    getUser: vi.fn().mockReturnValue(null),
                },
                user: { id: 'user456' },
            } as unknown as ChatInputCommandInteraction;

            const result = await getLeagueIdentityFromInteraction(interaction);

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

            const targetUser = { id: 'target789' };
            const interaction = {
                options: {
                    getString: vi.fn().mockReturnValue(null),
                    getUser: vi.fn().mockReturnValue(targetUser),
                },
                user: { id: 'user123' },
            } as unknown as ChatInputCommandInteraction;

            const result = await getLeagueIdentityFromInteraction(interaction);

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

            const interaction = {
                options: {
                    getString: vi.fn().mockReturnValue(null),
                    getUser: vi.fn().mockReturnValue(null),
                },
                user: { id: 'user999' },
            } as unknown as ChatInputCommandInteraction;

            const result = await getLeagueIdentityFromInteraction(interaction);

            expect(riotService.resolveLeagueIdentity).toHaveBeenCalledWith({
                summoner: undefined,
                region: undefined,
                userId: 'user999',
            });
            expect(result).toEqual(mockIdentity);
        });
    });
});
