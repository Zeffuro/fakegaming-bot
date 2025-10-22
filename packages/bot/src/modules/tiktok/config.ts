/**
 * Provider-specific configuration for the TikTok subscription command.
 */
export interface TikTokSuccessArgs { username: string; channelId: string }
export interface TikTokUsernameArgs { username: string }

export const tiktokCommandConfig = {
    commandName: 'add-tiktok-stream',
    description: 'Add a TikTok account for live notifications',
    usernameOptionDescription: 'TikTok username (with or without @)',
    successMessage: ({ username, channelId }: TikTokSuccessArgs): string =>
        `TikTok account \`${username}\` added for notifications in <#${channelId}>.`,
    alreadyConfiguredMessage: ({ username }: TikTokUsernameArgs): string =>
        `TikTok account \`${username}\` is already configured for notifications in this channel.`,
    notFoundMessage: ({ username }: TikTokUsernameArgs): string =>
        `TikTok user \`${username}\` does not exist.`,
} as const;

export type TikTokCommandConfig = typeof tiktokCommandConfig;

