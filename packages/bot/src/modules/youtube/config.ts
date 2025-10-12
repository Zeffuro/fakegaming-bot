/**
 * Provider-specific configuration for the YouTube subscription command.
 */
export interface YoutubeSuccessArgs { username: string; channelId: string }
export interface YoutubeUsernameArgs { username: string }

export const youtubeCommandConfig = {
    commandName: 'add-youtube-channel',
    description: 'Add a Youtube Channel for new video notifications',
    usernameOptionDescription: 'Youtube username',
    successMessage: ({ username, channelId }: YoutubeSuccessArgs): string =>
        `Youtube channel \`${username}\` added for video notifications in #${channelId}.`,
    alreadyConfiguredMessage: ({ username }: YoutubeUsernameArgs): string =>
        `Youtube channel \`${username}\` is already configured for video notifications in this channel.`,
    notFoundMessage: ({ username }: YoutubeUsernameArgs): string =>
        `Youtube channel \`${username}\` does not exist.`,
} as const;

export type YoutubeCommandConfig = typeof youtubeCommandConfig;

