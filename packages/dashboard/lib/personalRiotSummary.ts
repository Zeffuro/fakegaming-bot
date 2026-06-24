import type { RiotLinkEntry } from "@/lib/api-client";

export type PersonalRiotSummaryTone = "default" | "success" | "warning";

export interface PersonalRiotSummaryRow {
    label: string;
    value: string;
    tone: PersonalRiotSummaryTone;
}

export interface PersonalRiotSummary {
    linked: boolean;
    badgeLabel: string;
    summaryText: string;
    helperText: string;
    rows: PersonalRiotSummaryRow[];
}

export function buildPersonalRiotSummary(
    link: RiotLinkEntry | null,
    formatDate: (value: string | null) => string,
): PersonalRiotSummary {
    if (!link) {
        return {
            linked: false,
            badgeLabel: "No link",
            summaryText: "No linked Riot account",
            helperText: "Use /link-riot in Discord to connect an account for League and TFT commands.",
            rows: [],
        };
    }

    const riotId = displayRiotId(link);
    const region = formatRiotRegion(link.region);
    const accountKeyReady = link.puuid.trim().length > 0;

    return {
        linked: true,
        badgeLabel: "Linked",
        summaryText: `${riotId} in ${region}`,
        helperText: "League and TFT commands use this account when no Riot ID is provided.",
        rows: [
            { label: "Riot ID", value: riotId, tone: "default" },
            { label: "Region", value: region, tone: "default" },
            {
                label: "Command status",
                value: accountKeyReady ? "Ready for League and TFT commands" : "Missing account key",
                tone: accountKeyReady ? "success" : "warning",
            },
            {
                label: "Updated",
                value: formatDate(link.updatedAt ?? link.createdAt ?? null),
                tone: "default",
            },
        ],
    };
}

export function displayRiotId(link: Pick<RiotLinkEntry, "summonerName" | "riotIdGameName" | "riotIdTagLine">): string {
    const gameName = link.riotIdGameName?.trim();
    const tagLine = link.riotIdTagLine?.trim();
    if (gameName && tagLine) return `${gameName}#${tagLine}`;
    return link.summonerName;
}

export function formatRiotRegion(region: string): string {
    return region.trim().toUpperCase() || "Unknown";
}
