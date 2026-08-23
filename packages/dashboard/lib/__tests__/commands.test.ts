import { describe, expect, it } from "vitest";
import type { BotCommand } from "@/lib/commands";
import { getLocalizedBotCommand } from "@/lib/commands";

const command: BotCommand = {
    name: "permissions-backup",
    description: "Save and export permissions",
    localizations: {
        nl: {
            description: "Bewaar en exporteer rechten",
        },
    },
};

describe("getLocalizedBotCommand", () => {
    it("uses the canonical name with the Dutch description", () => {
        expect(getLocalizedBotCommand(command, "nl")).toEqual({
            name: "permissions-backup",
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
