import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupModelMocks, setupCommandTest } from "@zeffuro/fakegaming-common/testing";
import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { Regions } from "twisted/dist/constants/regions.js";

// Ensure DB/model mocks are ready
beforeAll(() => {
    setupModelMocks();
});

// Mock riotService
vi.mock("../../../services/riotService.js", () => ({
    resolveLeagueIdentity: vi.fn(),
}));

// Mock leagueUtils
const mockGetRegionCodeFromName = vi.fn((regionInput: string) => {
    if (regionInput === "EU_WEST") return "EUW";
    if (regionInput === "AMERICA_NORTH") return "NA";
    return regionInput;
});
vi.mock("../utils/leagueUtils.js", () => ({
    getRegionCodeFromName: mockGetRegionCodeFromName,
}));

describe("linkRiot command", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetRegionCodeFromName.mockImplementation((regionInput: string) => {
            if (regionInput === "EU_WEST") return "EUW";
            if (regionInput === "AMERICA_NORTH") return "NA";
            return regionInput;
        });
    });

    it("creates a new LeagueConfig entry if none exists", async () => {
        const { resolveLeagueIdentity } = await import("../../../services/riotService.js");
        vi.mocked(resolveLeagueIdentity).mockResolvedValue({
            summoner: "TestSummoner",
            region: "EUW" as Regions,
            puuid: "test-puuid-12345",
        });

        const { LeagueConfig: _LeagueConfig } = await import("@zeffuro/fakegaming-common/models");
        const createSpy = vi.spyOn(_LeagueConfig, "create").mockResolvedValue({
            discordId: "123456789012345678",
            summonerName: "TestSummoner",
            region: "EUW",
            puuid: "test-puuid-12345",
        } as any);

        const getUserWithLeagueSpy = vi.fn().mockResolvedValue(null);

        const { command, interaction } = await setupCommandTest("modules/league/commands/linkRiot.js", {
            interaction: {
                options: {
                    getString: vi.fn((name) =>
                        name === "riot-id" ? "TestSummoner#EUW" : name === "region" ? "EU_WEST" : null
                    ),
                    getUser: vi.fn().mockReturnValue(null),
                },
                user: { id: "123456789012345678" },
                guild: { members: { fetch: vi.fn().mockResolvedValue(null) } },
                deferReply: vi.fn(),
                editReply: vi.fn(),
            },
            managerOverrides: {
                userManager: { getUserWithLeague: getUserWithLeagueSpy },
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(resolveLeagueIdentity).toHaveBeenCalledWith({
            summoner: "TestSummoner#EUW",
            region: "EUW",
            userId: "123456789012345678",
        });
        expect(getUserWithLeagueSpy).toHaveBeenCalledWith("123456789012345678");
        expect(createSpy).toHaveBeenCalledWith({
            discordId: "123456789012345678",
            summonerName: "TestSummoner",
            region: "EUW",
            puuid: "test-puuid-12345",
        });
        expect(interaction.editReply).toHaveBeenCalledWith(
            "Linked <@123456789012345678> to Riot ID: TestSummoner [EUW]"
        );
    });

    it("updates an existing LeagueConfig entry", async () => {
        const { resolveLeagueIdentity } = await import("../../../services/riotService.js");
        vi.mocked(resolveLeagueIdentity).mockResolvedValue({
            summoner: "NewSummoner",
            region: "NA" as Regions,
            puuid: "new-puuid-67890",
        });

        const { LeagueConfig: _LeagueConfig } = await import("@zeffuro/fakegaming-common/models");
        const updateSpy = vi.fn().mockResolvedValue([1]);

        const { getConfigManager } = await import("@zeffuro/fakegaming-common/managers");
        const userManager = getConfigManager().userManager;

        // Return a mock user with a league object that has an update method
        const getUserWithLeagueSpy = vi
            .spyOn(userManager, "getUserWithLeague")
            .mockResolvedValue({
                league: { update: updateSpy } // <-- proper mock
            } as any);

        const { command, interaction } = await setupCommandTest("modules/league/commands/linkRiot.js", {
            interaction: {
                options: {
                    getString: vi.fn((name) =>
                        name === "riot-id" ? "NewSummoner#NA" : name === "region" ? "AMERICA_NORTH" : null
                    ),
                    getUser: vi.fn().mockReturnValue(null),
                },
                user: { id: "123456789012345678" },
                guild: { members: { fetch: vi.fn().mockResolvedValue(null) } },
                deferReply: vi.fn(),
                editReply: vi.fn(),
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getUserWithLeagueSpy).toHaveBeenCalledWith("123456789012345678");
        expect(updateSpy).toHaveBeenCalledWith(
            {
                summonerName: "NewSummoner",
                region: "NA",
                puuid: "new-puuid-67890",
            }
        );
        expect(interaction.editReply).toHaveBeenCalledWith(
            "Linked <@123456789012345678> to Riot ID: NewSummoner [NA]"
        );
    });

    it("allows admins to link another user", async () => {
        // Clear the module cache before this test
        vi.resetModules();

        // Set up the manager mocks FIRST
        const getUserWithLeagueSpy = vi.fn().mockResolvedValue(null);
        const addSpy = vi.fn().mockResolvedValue({
            discordId: "987654321098765432",
            league: null,
        });

        // Mock the entire managers module before ANY imports
        vi.doMock("@zeffuro/fakegaming-common/managers", () => ({
            getConfigManager: vi.fn(() => ({
                userManager: {
                    getUserWithLeague: getUserWithLeagueSpy,
                    add: addSpy,
                },
            })),
        }));

        // NOW import everything else
        const { resolveLeagueIdentity } = await import("../../../services/riotService.js");
        vi.mocked(resolveLeagueIdentity).mockResolvedValue({
            summoner: "TestSummoner",
            region: "EUW" as Regions,
            puuid: "test-puuid-12345",
        });

        const modelsModule = await import("@zeffuro/fakegaming-common/models");
        const createSpy = vi.spyOn(modelsModule.LeagueConfig, "create").mockResolvedValue({
            discordId: "987654321098765432",
            summonerName: "TestSummoner",
            region: "EUW",
            puuid: "test-puuid-12345",
        } as any);

        // Import the command LAST
        const commandModule = await import("../commands/linkRiot.js");
        const command = commandModule.default;

        // Create interaction mock
        const interaction = {
            options: {
                getString: vi.fn((name: string) => {
                    if (name === "riot-id") return "TestSummoner#EUW";
                    if (name === "region") return "EU_WEST";
                    return null;
                }),
                getUser: vi.fn((name: string) => {
                    if (name === "user") return { id: "987654321098765432" };
                    return null;
                }),
            },
            user: { id: "123456789012345678" },
            guild: {
                members: {
                    fetch: vi.fn((userId: string) => {
                        if (userId === "123456789012345678") {
                            return Promise.resolve({
                                permissions: {
                                    has: vi.fn(() => true)
                                }
                            });
                        }
                        return Promise.resolve(null);
                    }),
                },
            },
            deferReply: vi.fn().mockResolvedValue(undefined),
            editReply: vi.fn().mockResolvedValue(undefined),
            reply: vi.fn().mockResolvedValue(undefined),
        } as unknown as ChatInputCommandInteraction;

        // Execute the command
        await command.execute(interaction);

        // Assertions
        expect(interaction.deferReply).toHaveBeenCalled();
        expect(resolveLeagueIdentity).toHaveBeenCalledWith({
            summoner: "TestSummoner#EUW",
            region: "EUW",
            userId: "987654321098765432",
        });
        expect(getUserWithLeagueSpy).toHaveBeenCalledWith("987654321098765432");
        expect(addSpy).toHaveBeenCalledWith({ discordId: "987654321098765432" });
        expect(createSpy).toHaveBeenCalledWith({
            discordId: "987654321098765432",
            summonerName: "TestSummoner",
            region: "EUW",
            puuid: "test-puuid-12345",
        });
        expect(interaction.editReply).toHaveBeenCalledWith(
            "Linked <@987654321098765432> to Riot ID: TestSummoner [EUW]"
        );
    });

    it("blocks non-admins from linking other users", async () => {
        const { resolveLeagueIdentity } = await import("../../../services/riotService.js");

        const { command, interaction } = await setupCommandTest("modules/league/commands/linkRiot.js", {
            interaction: {
                options: {
                    getString: vi.fn(),
                    getUser: vi.fn().mockReturnValue({ id: "987654321098765432" }),
                },
                user: { id: "123456789012345678" },
                guild: {
                    members: { fetch: vi.fn().mockResolvedValue({ permissions: { has: () => false } }) },
                },
                reply: vi.fn(),
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: "You need admin permissions to link for another user.",
            flags: MessageFlags.Ephemeral,
        });
        expect(resolveLeagueIdentity).not.toHaveBeenCalled();
    });

    it("handles errors when resolving league identity", async () => {
        const { resolveLeagueIdentity } = await import("../../../services/riotService.js");
        vi.mocked(resolveLeagueIdentity).mockRejectedValue(new Error("Invalid Riot ID or region"));

        const { command, interaction } = await setupCommandTest("modules/league/commands/linkRiot.js", {
            interaction: {
                options: {
                    getString: vi.fn(() => "InvalidSummoner#INVALID"),
                    getUser: vi.fn().mockReturnValue(null),
                },
                user: { id: "123456789012345678" },
                guild: { members: { fetch: vi.fn().mockResolvedValue(null) } },
                deferReply: vi.fn(),
                editReply: vi.fn(),
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            "Failed to resolve Riot Account. Please check the Riot ID and region."
        );
    });
});
