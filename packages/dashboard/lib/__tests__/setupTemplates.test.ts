import { describe, expect, it } from "vitest";
import {
    getSetupTemplateChannelSlotDescriptionKey,
    getSetupTemplateChannelSlotLabelKey,
    getSetupTemplateDescriptionKey,
    getSetupTemplateFindingIdKey,
    getSetupTemplateFindingKey,
    getSetupTemplateInputGroupDescriptionKey,
    getSetupTemplateInputGroupLabelKey,
    getSetupTemplateInputGroupPlaceholderKey,
    getSetupTemplateNameKey,
    getSetupTemplateProviderKey,
    getSetupTemplateWarningIdKey,
    getSetupTemplateWarningKey,
} from "@/lib/setupTemplateCopy";
import {
    buildSetupTemplateRequest,
    getSetupTemplateValidationErrorKey,
} from "@/lib/setupTemplateRequest";

describe("setup template dashboard helpers", () => {
    it("maps every known API-owned setup-template field to a dashboard message key", () => {
        for (const id of ["streamer-alerts", "patch-notes", "anime-club", "gaming-community"]) {
            expect(getSetupTemplateNameKey(id)).not.toBeNull();
            expect(getSetupTemplateDescriptionKey(id)).not.toBeNull();
        }

        for (const key of ["live", "videos", "patches", "anime", "steamNews"]) {
            expect(getSetupTemplateChannelSlotLabelKey(key)).not.toBeNull();
            expect(getSetupTemplateChannelSlotDescriptionKey(key)).not.toBeNull();
        }

        for (const key of ["twitchUsernames", "youtubeChannelIds", "patchGames", "animeIds", "steamApps"]) {
            expect(getSetupTemplateInputGroupLabelKey(key)).not.toBeNull();
            expect(getSetupTemplateInputGroupDescriptionKey(key)).not.toBeNull();
            expect(getSetupTemplateInputGroupPlaceholderKey(key)).not.toBeNull();
        }

        for (const provider of ["Twitch", "YouTube", "Patch Notes", "Anime", "Steam News"]) {
            expect(getSetupTemplateProviderKey(provider)).not.toBeNull();
        }

        expect(getSetupTemplateFindingKey("This provider/source/channel route already exists.")).not.toBeNull();
        expect(getSetupTemplateWarningKey("Add at least one template input before applying this setup.")).not.toBeNull();
        expect(getSetupTemplateFindingIdKey("duplicateRoute")).toBe("setupTemplates.finding.duplicateRoute");
        expect(getSetupTemplateWarningIdKey("addInput")).toBe("setupTemplates.warning.addInput");
        expect(getSetupTemplateNameKey("third-party-template")).toBeNull();
        expect(getSetupTemplateFindingIdKey("third-party-finding")).toBeNull();
    });

    it("normalizes valid inputs and reports local validation errors by message key", () => {
        expect(buildSetupTemplateRequest("guild-1", { live: " channel-1 " }, {
            twitchUsernames: "riotgames, cohhcarnage",
            animeIds: "154587\n170942",
            steamApps: "730: Counter-Strike 2",
        })).toEqual({
            guildId: "guild-1",
            channels: { live: "channel-1" },
            inputs: {
                twitchUsernames: ["riotgames", "cohhcarnage"],
                animeIds: [154587, 170942],
                steamApps: [{ appId: 730, name: "Counter-Strike 2" }],
            },
        });

        try {
            buildSetupTemplateRequest("guild-1", {}, { animeIds: "not-an-id" });
            throw new Error("Expected AniList validation to throw");
        } catch (error) {
            expect(getSetupTemplateValidationErrorKey(error)).toBe("setupTemplates.validation.anilistIds");
        }

        try {
            buildSetupTemplateRequest("guild-1", {}, { steamApps: "not-an-id: Test" });
            throw new Error("Expected Steam validation to throw");
        } catch (error) {
            expect(getSetupTemplateValidationErrorKey(error)).toBe("setupTemplates.validation.steamApps");
        }
    });
});
