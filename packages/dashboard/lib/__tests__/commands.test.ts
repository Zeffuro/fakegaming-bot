import { describe, expect, it } from "vitest";
import type { BotCommand } from "@/lib/commands";
import { getLocalizedBotCommand } from "@/lib/commands";

const command: BotCommand = {
    name: "permissions-backup",
    description: "Save and export permissions",
    localizations: {
        nl: {
            name: "rechten-back-up",
            description: "Bewaar en exporteer rechten",
        },
    },
};

describe("getLocalizedBotCommand", () => {
    it("uses Dutch manifest metadata for Dutch dashboards", () => {
        expect(getLocalizedBotCommand(command, "nl")).toEqual({
            name: "rechten-back-up",
            description: "Bewaar en exporteer rechten",
        });
    });

    it("uses the stable English metadata for English dashboards", () => {
        expect(getLocalizedBotCommand(command, "en")).toEqual({
            name: "permissions-backup",
            description: "Save and export permissions",
        });
    });
});
