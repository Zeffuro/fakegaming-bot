import { setupCommandTest, expectEditReplyWithAttachment, expectEditReplyContainsText } from '@zeffuro/fakegaming-common/testing';
import type { Regions } from 'twisted/dist/constants/regions.js';
import { vi } from 'vitest';

/**
 * Factory to create strongly-typed helpers for League/TFT history tests.
 */
export function makeHistoryTestHelpers(config: {
    commandPath: string;
    attachmentName: string;
    serviceKeys: {
        history: 'getMatchHistory' | 'getTftMatchHistory';
        details: 'getMatchDetails' | 'getTftMatchDetails';
    };
}) {
    const { commandPath, attachmentName, serviceKeys } = config;

    async function setupCmd(overrides?: Record<string, unknown>) {
        return setupCommandTest(commandPath, { interaction: overrides || {} });
    }

    async function mockIdentity(region: Regions = 'EUW' as Regions, puuid = 'test-puuid-12345', summoner = 'TestSummoner') {
        const { getLeagueIdentityFromInteraction } = await import('../../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockResolvedValue({ summoner, region, puuid });
        return { getLeagueIdentityFromInteraction };
    }

    async function mockHistory(idsOrError: string[] | { success: false; error: string }) {
        const riot = await import('../../../../services/riotService.js');
        const historyFn = riot[serviceKeys.history as keyof typeof riot];
        if (Array.isArray(idsOrError)) {
            vi.mocked(historyFn as any).mockResolvedValue({ success: true, data: idsOrError });
        } else {
            vi.mocked(historyFn as any).mockResolvedValue(idsOrError as any);
        }
        return { [serviceKeys.history]: historyFn } as Record<string, unknown>;
    }

    async function mockDetails(data: unknown) {
        const riot = await import('../../../../services/riotService.js');
        const detailsFn = riot[serviceKeys.details as keyof typeof riot];
        vi.mocked(detailsFn as any).mockResolvedValue({ success: true, data } as any);
        return { [serviceKeys.details]: detailsFn } as Record<string, unknown>;
    }

    function expectAttachment(interaction: unknown, contentContains: string) {
        expectEditReplyWithAttachment(interaction, { filenameIncludes: attachmentName, contentContains });
    }

    function expectErrorText(interaction: unknown, text: string) {
        expectEditReplyContainsText(interaction, text);
    }

    return {
        setupCmd,
        mockIdentity,
        mockHistory,
        mockDetails,
        expectAttachment,
        expectErrorText
    };
}
