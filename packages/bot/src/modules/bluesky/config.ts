export interface BlueskySuccessArgs { username: string; channelId: string }
export interface BlueskyUsernameArgs { username: string }

export const blueskyCommandConfig = {
    commandName: 'add-bluesky-account',
    description: 'Add a Bluesky account for post notifications',
    usernameOptionDescription: 'Bluesky handle (with or without @)',
    successMessage: ({ username, channelId }: BlueskySuccessArgs): string =>
        `Bluesky account \`${username}\` added for notifications in <#${channelId}>.`,
    alreadyConfiguredMessage: ({ username }: BlueskyUsernameArgs): string =>
        `Bluesky account \`${username}\` is already configured for notifications in this channel.`,
    notFoundMessage: ({ username }: BlueskyUsernameArgs): string =>
        `Bluesky account \`${username}\` does not exist.`,
} as const;

export type BlueskyCommandConfig = typeof blueskyCommandConfig;
