import type {
    SetupTemplateChannelSlotKey,
    SetupTemplateRequest,
    SetupTemplateSteamAppInput,
} from "@/lib/api-client";
import type { DashboardMessageKey } from "@/lib/i18n/messages";

export class SetupTemplateValidationError extends Error {
    public readonly messageKey: DashboardMessageKey;

    public constructor(messageKey: DashboardMessageKey) {
        super(messageKey);
        this.name = "SetupTemplateValidationError";
        this.messageKey = messageKey;
    }
}

export function buildSetupTemplateRequest(
    guildId: string,
    channelValues: Record<string, string>,
    inputValues: Record<string, string>,
): SetupTemplateRequest {
    const inputs: NonNullable<SetupTemplateRequest["inputs"]> = {};
    const twitchUsernames = parseDelimitedText(inputValues.twitchUsernames);
    const youtubeChannelIds = parseDelimitedText(inputValues.youtubeChannelIds);
    const patchGames = parseDelimitedText(inputValues.patchGames);
    const animeIds = parsePositiveIntegerList(inputValues.animeIds);
    const steamApps = parseSteamApps(inputValues.steamApps);

    if (twitchUsernames.length > 0) inputs.twitchUsernames = twitchUsernames;
    if (youtubeChannelIds.length > 0) inputs.youtubeChannelIds = youtubeChannelIds;
    if (patchGames.length > 0) inputs.patchGames = patchGames;
    if (animeIds.length > 0) inputs.animeIds = animeIds;
    if (steamApps.length > 0) inputs.steamApps = steamApps;

    return {
        guildId,
        channels: normalizeTemplateChannels(channelValues),
        inputs,
    };
}

export function getSetupTemplateValidationErrorKey(error: unknown): DashboardMessageKey | null {
    return error instanceof SetupTemplateValidationError ? error.messageKey : null;
}

function normalizeTemplateChannels(values: Record<string, string>): SetupTemplateRequest["channels"] {
    const keys: SetupTemplateChannelSlotKey[] = ["live", "videos", "patches", "anime", "steamNews"];
    return keys.reduce<SetupTemplateRequest["channels"]>((channels, key) => {
        const value = values[key]?.trim();
        if (value) channels[key] = value;
        return channels;
    }, {});
}

function parseDelimitedText(value: string | undefined): string[] {
    return (value ?? "")
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

function parsePositiveIntegerList(value: string | undefined): number[] {
    return parseDelimitedText(value).map((item) => {
        const parsed = Number(item);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            throw new SetupTemplateValidationError("setupTemplates.validation.anilistIds");
        }
        return parsed;
    });
}

function parseSteamApps(value: string | undefined): SetupTemplateSteamAppInput[] {
    return parseDelimitedText(value).map((item) => {
        const [rawAppId, ...rawNameParts] = item.split(":");
        const appId = Number(rawAppId?.trim());
        if (!Number.isInteger(appId) || appId <= 0) {
            throw new SetupTemplateValidationError("setupTemplates.validation.steamApps");
        }

        const name = rawNameParts.join(":").trim();
        return {
            appId,
            ...(name ? { name } : {}),
        };
    });
}
