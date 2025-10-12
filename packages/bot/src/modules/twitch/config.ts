/**
 * Provider-specific configuration for the Twitch subscription command.
 */
export interface TwitchSuccessArgs { username: string; channelId: string }
export interface TwitchUsernameArgs { username: string }

export const twitchCommandConfig = {
    commandName: 'add-twitch-stream',
    description: 'Add a Twitch stream for notifications',
    usernameOptionDescription: 'Twitch username',
    successMessage: ({ username, channelId }: TwitchSuccessArgs): string =>
        `Twitch stream \`${username}\` added for notifications in <#${channelId}>.`,
    alreadyConfiguredMessage: ({ username }: TwitchUsernameArgs): string =>
        `Twitch stream \`${username}\` is already configured for notifications in this channel.`,
    notFoundMessage: ({ username }: TwitchUsernameArgs): string =>
        `Twitch user \`${username}\` does not exist.`,
} as const;

export type TwitchCommandConfig = typeof twitchCommandConfig;

