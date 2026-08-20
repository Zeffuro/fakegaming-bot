/**
 * Provider-specific configuration for the TikTok subscription command.
 */
export interface TikTokSuccessArgs { username: string; channelId: string }
export interface TikTokUsernameArgs { username: string }

export const tiktokCommandConfig = {
    commandName: 'add-tiktok-stream',
    description: 'Add a TikTok account for live notifications',
    usernameOptionDescriptions: { en: 'TikTok username (with or without @)', nl: 'TikTok-gebruikersnaam (met of zonder @)' },
    successMessages: {
        en: ({ username, channelId }: TikTokSuccessArgs): string => `TikTok account \`${username}\` added for notifications in <#${channelId}>.`,
        nl: ({ username, channelId }: TikTokSuccessArgs): string => `TikTok-account \`${username}\` toegevoegd voor meldingen in <#${channelId}>.`,
    },
    alreadyConfiguredMessages: {
        en: ({ username }: TikTokUsernameArgs): string => `TikTok account \`${username}\` is already configured for notifications in this channel.`,
        nl: ({ username }: TikTokUsernameArgs): string => `TikTok-account \`${username}\` is al ingesteld voor meldingen in dit kanaal.`,
    },
    notFoundMessages: {
        en: ({ username }: TikTokUsernameArgs): string => `TikTok user \`${username}\` does not exist.`,
        nl: ({ username }: TikTokUsernameArgs): string => `TikTok-gebruiker \`${username}\` bestaat niet.`,
    },
} as const;

export type TikTokCommandConfig = typeof tiktokCommandConfig;

