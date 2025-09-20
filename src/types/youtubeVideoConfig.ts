/**
 * Configuration for a YouTube video channel announcement.
 * - youtubeChannelId: The YouTube channel's ID.
 * - discordChannelId: The Discord channel to post announcements in.
 * - lastVideoId: The last announced video ID (optional).
 * - customMessage: A custom message to include with announcements (optional).
 */
export interface YoutubeVideoConfig {
    youtubeChannelId: string;
    discordChannelId: string;
    lastVideoId?: string;
    customMessage?: string;
}