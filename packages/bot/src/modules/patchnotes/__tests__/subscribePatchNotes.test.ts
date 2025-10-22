import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { setupCommandTest, expectReplyText, expectReplyTextContains, expectReplyHasEmbedsArray, expectEphemeralReply } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';

// Mock the patch note embed builder
vi.mock('../shared/patchNoteEmbed.js', () => ({
    buildPatchNoteEmbed: vi.fn().mockReturnValue({ /* mock embed */ })
}));

// Mock the permissions utility
vi.mock('../../../utils/permissions.js', () => ({
    requireAdmin: vi.fn()
}));

// Import mocked functions after mocking
import { buildPatchNoteEmbed } from '../shared/patchNoteEmbed.js';
import { requireAdmin } from '../../../utils/permissions.js';

// Add Mock type definition
type Mock = MockedFunction<typeof requireAdmin>;

// --- local helpers (DRY) ---
function assertSubscribedWithEmbed(opts: {
    interaction: any;
    game: string;
    channelId: string;
    guildId: string;
    subscribeSpy: ReturnType<typeof vi.fn>;
    getLatestPatchSpy: ReturnType<typeof vi.fn>;
    patch: any;
}) {
    const { interaction, game, channelId, guildId, subscribeSpy, getLatestPatchSpy, patch } = opts;
    expect(requireAdmin).toHaveBeenCalledWith(interaction);
    expect(subscribeSpy).toHaveBeenCalledWith(game, channelId, guildId);
    expect(getLatestPatchSpy).toHaveBeenCalledWith(game);
    expect(buildPatchNoteEmbed).toHaveBeenCalledWith(patch);
    expectReplyTextContains(interaction, `Subscribed <#${channelId}> to patch notes for \`${game}\`.`);
    expectReplyHasEmbedsArray(interaction);
}

function assertSubscribedNoEmbed(opts: {
    interaction: any;
    game: string;
    channelId: string;
    guildId: string;
    subscribeSpy: ReturnType<typeof vi.fn>;
}) {
    const { interaction, game, channelId, guildId, subscribeSpy } = opts;
    expect(subscribeSpy).toHaveBeenCalledWith(game, channelId, guildId);
    expectReplyText(
        interaction,
        `Subscribed <#${channelId}> to patch notes for \`${game}\`.`
    );
    expect(buildPatchNoteEmbed).not.toHaveBeenCalled();
}

function assertSubscribeDenied(opts: {
    interaction: any;
    subscribeSpy: ReturnType<typeof vi.fn>;
    getLatestPatchSpy: ReturnType<typeof vi.fn>;
}) {
    const { interaction, subscribeSpy, getLatestPatchSpy } = opts;
    expect(requireAdmin).toHaveBeenCalledWith(interaction);
    expect(subscribeSpy).not.toHaveBeenCalled();
    expect(getLatestPatchSpy).not.toHaveBeenCalled();
    expectReplyTextContains(interaction, 'You do not have permission to subscribe channels');
    expectEphemeralReply(interaction);
}

/**
 * DRY setup for subscribePatchNotes tests
 */
async function setupSubscribeTest(opts: {
    game: string;
    channelId: string;
    guildId: string;
    subscribeSpy: ReturnType<typeof vi.fn>;
    getLatestPatchSpy: ReturnType<typeof vi.fn>;
}) {
    const { game, channelId, guildId, subscribeSpy, getLatestPatchSpy } = opts;
    const { command, interaction } = await setupCommandTest(
        'modules/patchnotes/commands/subscribePatchNotes.js',
        {
            interaction: {
                stringOptions: { game },
                channelOptions: { channel: channelId },
                guildId
            },
            managerOverrides: {
                patchSubscriptionManager: {
                    subscribe: subscribeSpy
                },
                patchNotesManager: {
                    getLatestPatch: getLatestPatchSpy
                }
            }
        }
    );
    return { command, interaction };
}

describe('subscribePatchNotes command', () => {
    beforeEach(() => {
        // Reset mock call history without tearing down module graph
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('subscribes a channel to patch notes and shows latest patch when available', async () => {
        // Mock the requireAdmin function to return true (user is admin)
        (requireAdmin as Mock).mockResolvedValue(true);

        // Create mock patch notes data
        const mockPatchNote = {
            game: 'LeagueOfLegends',
            title: 'Patch 11.23',
            content: 'Test patch content',
            url: 'https://example.com/patch-notes',
            date: new Date()
        };

        // Create spy for subscription manager
        const subscribeSpy = vi.fn().mockResolvedValue({ id: 'sub123' });

        // Create spy for patch notes manager
        const getLatestPatchSpy = vi.fn().mockResolvedValue(mockPatchNote);

        // Setup mock channel id
        const channelId = '929533532185956352';
        const guildId = '135381928284343204';

        // Setup the test environment (DRY)
        const { command, interaction } = await setupSubscribeTest({
            game: 'LeagueOfLegends',
            channelId,
            guildId,
            subscribeSpy,
            getLatestPatchSpy,
        });

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Assertions (DRY helper)
        assertSubscribedWithEmbed({
            interaction,
            game: 'LeagueOfLegends',
            channelId,
            guildId,
            subscribeSpy,
            getLatestPatchSpy,
            patch: mockPatchNote,
        });
    });

    it('subscribes a channel to patch notes without showing latest patch when not available', async () => {
        // Mock the requireAdmin function to return true (user is admin)
        (requireAdmin as Mock).mockResolvedValue(true);

        // Create spy for subscription manager
        const subscribeSpy = vi.fn().mockResolvedValue({ id: 'sub123' });

        // Create spy for patch notes manager - no patch notes available
        const getLatestPatchSpy = vi.fn().mockResolvedValue(null);

        const channelId = '929533532185956352';
        const guildId = '135381928284343204';

        // Setup the test environment (DRY)
        const { command, interaction } = await setupSubscribeTest({
            game: 'Valorant',
            channelId,
            guildId,
            subscribeSpy,
            getLatestPatchSpy,
        });

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Assertions (DRY helper)
        assertSubscribedNoEmbed({
            interaction,
            game: 'Valorant',
            channelId,
            guildId,
            subscribeSpy,
        });
    });

    it('prevents non-admin users from subscribing channels', async () => {
        // Mock the requireAdmin function to return false (user is not admin)
        (requireAdmin as Mock).mockImplementation(async (interactionArg: any) => {
            await interactionArg.reply({ content: 'You do not have permission to subscribe channels', flags: 64 });
            return false;
        });

        // Create spies that should NOT be called
        const subscribeSpy = vi.fn();
        const getLatestPatchSpy = vi.fn();

        const channelId = '929533532185956352';
        const guildId = '135381928284343204';

        // Setup the test environment (DRY)
        const { command, interaction } = await setupSubscribeTest({
            game: 'LeagueOfLegends',
            channelId,
            guildId,
            subscribeSpy,
            getLatestPatchSpy,
        });

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Assertions (DRY helper)
        assertSubscribeDenied({ interaction, subscribeSpy, getLatestPatchSpy });
    });

    // Test for autocomplete function
    it('calls gameAutocomplete for autocomplete interaction', async () => {
        const { runAutocompleteSmokeTest } = await import('../shared/__tests__/helpers/patchnotesTestHelpers.js');
        await runAutocompleteSmokeTest('modules/patchnotes/commands/subscribePatchNotes.js', '');
    });
});
