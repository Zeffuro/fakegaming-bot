/**
 * Provider-specific configuration for the YouTube subscription command.
 */
export interface YoutubeSuccessArgs { username: string; channelId: string }
export interface YoutubeUsernameArgs { username: string }

export const youtubeCommandConfig = {
    commandName: 'add-youtube-channel',
    description: 'Add a Youtube Channel for new video notifications',
    usernameOptionDescriptions: { en: 'Youtube username', nl: 'YouTube-gebruikersnaam, handle, URL of kanaal-ID' },
    successMessages: {
        en: ({ username, channelId }: YoutubeSuccessArgs): string => `Youtube channel \`${username}\` added for video notifications in #${channelId}.`,
        nl: ({ username, channelId }: YoutubeSuccessArgs): string => `YouTube-kanaal \`${username}\` toegevoegd voor videomeldingen in <#${channelId}>.`,
    },
    alreadyConfiguredMessages: {
        en: ({ username }: YoutubeUsernameArgs): string => `Youtube channel \`${username}\` is already configured for video notifications in this channel.`,
        nl: ({ username }: YoutubeUsernameArgs): string => `YouTube-kanaal \`${username}\` is al ingesteld voor videomeldingen in dit kanaal.`,
    },
    notFoundMessages: {
        en: ({ username }: YoutubeUsernameArgs): string => `Youtube channel \`${username}\` does not exist.`,
        nl: ({ username }: YoutubeUsernameArgs): string => `YouTube-kanaal \`${username}\` bestaat niet.`,
    },
} as const;

export type YoutubeCommandConfig = typeof youtubeCommandConfig;

