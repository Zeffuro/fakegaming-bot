export interface PersonalNotificationPausePreferences {
    enabled: boolean; resumeAt: number | null; timezone: string; version: number;
}
export interface PersonalNotificationPauseInput {
    enabled: boolean; resumeAt: string | null; timezone: string; version: number;
}
