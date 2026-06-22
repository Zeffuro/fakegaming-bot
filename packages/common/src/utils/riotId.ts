export interface RiotIdParts {
    gameName: string;
    tagLine: string | null;
}

function clean(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

export function parseRiotId(value: string | null | undefined): RiotIdParts | null {
    const riotId = clean(value);
    if (!riotId) return null;

    const separatorIndex = riotId.indexOf('#');
    if (separatorIndex === -1) {
        return {gameName: riotId, tagLine: null};
    }

    const gameName = clean(riotId.slice(0, separatorIndex));
    const tagLine = clean(riotId.slice(separatorIndex + 1));
    if (!gameName) {
        return {gameName: riotId, tagLine: null};
    }

    return {gameName, tagLine};
}

export function formatRiotId(
    gameName: string | null | undefined,
    tagLine: string | null | undefined,
    fallback?: string | null
): string {
    const normalizedGameName = clean(gameName);
    const normalizedTagLine = clean(tagLine);
    if (normalizedGameName && normalizedTagLine) {
        return `${normalizedGameName}#${normalizedTagLine}`;
    }

    return clean(fallback) ?? normalizedGameName ?? '';
}
