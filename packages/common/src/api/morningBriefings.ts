export interface MorningBriefingPreferences {
    enabled: boolean; localTime: string; timezone: string; version: number;
}

export interface MorningBriefingPreview {
    day: string; timezone: string; content: string; empty: boolean; total: number; included: number; omitted: number;
}
