/**
 * Provider-specific configuration for the Twitch subscription command.
 */
export interface TwitchSuccessArgs { username: string; channelId: string }
export interface TwitchUsernameArgs { username: string }

export const twitchCommandConfig = {
    commandName: 'add-twitch-stream',
    description: 'Add a Twitch stream for notifications',
    usernameOptionDescriptions: { en: 'Twitch username', nl: 'Twitch-gebruikersnaam' },
    successMessages: {
        en: ({ username, channelId }: TwitchSuccessArgs): string => `Twitch stream \`${username}\` added for notifications in <#${channelId}>.`,
        nl: ({ username, channelId }: TwitchSuccessArgs): string => `Twitch-stream \`${username}\` toegevoegd voor meldingen in <#${channelId}>.`,
    },
    alreadyConfiguredMessages: {
        en: ({ username }: TwitchUsernameArgs): string => `Twitch stream \`${username}\` is already configured for notifications in this channel.`,
        nl: ({ username }: TwitchUsernameArgs): string => `Twitch-stream \`${username}\` is al ingesteld voor meldingen in dit kanaal.`,
    },
    notFoundMessages: {
        en: ({ username }: TwitchUsernameArgs): string => `Twitch user \`${username}\` does not exist.`,
        nl: ({ username }: TwitchUsernameArgs): string => `Twitch-gebruiker \`${username}\` bestaat niet.`,
    },
} as const;

export type TwitchCommandConfig = typeof twitchCommandConfig;

