/**
 * Configuration for a user's birthday in a Discord guild.
 * - userId: The Discord user ID.
 * - day: The day of the birthday (1-31).
 * - month: The month of the birthday (1-12).
 * - year: The year of birth (optional).
 * - guildId: The Discord guild ID.
 * - channelId: The Discord channel ID for birthday announcements.
 */
export type BirthdayConfig = {
    userId: string;
    day: number;
    month: number;
    year?: number;
    guildId: string;
    channelId: string;
};