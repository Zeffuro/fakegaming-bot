import type { RiotLinkEntry } from "@/lib/api-client";
import type { DashboardTranslator } from "@/lib/i18n/messages";

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
    t: DashboardTranslator,
): PersonalRiotSummary {
    if (!link) {
        return {
            linked: false,
            badgeLabel: t("personal.riotNoLinkBadge"),
            summaryText: t("personal.riotNoAccount"),
            helperText: t("personal.riotNoAccountHelp"),
            rows: [],
        };
    }

    const riotId = displayRiotId(link);
    const region = formatRiotRegion(link.region, t("common.unknown"));
    const accountKeyReady = link.puuid.trim().length > 0;

    return {
        linked: true,
        badgeLabel: t("personal.riotLinkedBadge"),
        summaryText: t("personal.riotSummary", { riotId, region }),
        helperText: t("personal.riotLinkedHelp"),
        rows: [
            { label: t("personal.riotId"), value: riotId, tone: "default" },
            { label: t("personal.region"), value: region, tone: "default" },
            {
                label: t("personal.commandStatus"),
                value: accountKeyReady ? t("personal.riotReady") : t("personal.riotMissingKey"),
                tone: accountKeyReady ? "success" : "warning",
            },
            {
                label: t("personal.updated"),
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

export function formatRiotRegion(region: string, unknownLabel: string): string {
    return region.trim().toUpperCase() || unknownLabel;
}
