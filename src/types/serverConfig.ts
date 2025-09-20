/**
 * Configuration for a Discord server.
 * - serverId: The server's Discord ID.
 * - prefix: The command prefix for the server.
 * - welcomeMessage: The welcome message for new members (optional).
 */
export type ServerConfig = {
    serverId: string;
    prefix: string;
    welcomeMessage?: string;
};