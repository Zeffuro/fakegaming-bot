/**
 * Configuration for a Twitch stream announcement.
 * - twitchUsername: The Twitch user's username.
 * - discordChannelId: The Discord channel to post announcements in.
 * - customMessage: A custom message to include with announcements (optional).
 */
export interface TwitchStreamConfig {
    twitchUsername: string;
    discordChannelId: string;
    customMessage?: string;
}