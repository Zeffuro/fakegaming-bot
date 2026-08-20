export interface BlueskySuccessArgs { username: string; channelId: string }
export interface BlueskyUsernameArgs { username: string }

export const blueskyCommandConfig = {
    commandName: 'add-bluesky-account',
    description: 'Add a Bluesky account for post notifications',
    usernameOptionDescriptions: { en: 'Bluesky handle (with or without @)', nl: 'Bluesky-handle (met of zonder @)' },
    successMessages: {
        en: ({ username, channelId }: BlueskySuccessArgs): string => `Bluesky account \`${username}\` added for notifications in <#${channelId}>.`,
        nl: ({ username, channelId }: BlueskySuccessArgs): string => `Bluesky-account \`${username}\` toegevoegd voor meldingen in <#${channelId}>.`,
    },
    alreadyConfiguredMessages: {
        en: ({ username }: BlueskyUsernameArgs): string => `Bluesky account \`${username}\` is already configured for notifications in this channel.`,
        nl: ({ username }: BlueskyUsernameArgs): string => `Bluesky-account \`${username}\` is al ingesteld voor meldingen in dit kanaal.`,
    },
    notFoundMessages: {
        en: ({ username }: BlueskyUsernameArgs): string => `Bluesky account \`${username}\` does not exist.`,
        nl: ({ username }: BlueskyUsernameArgs): string => `Bluesky-account \`${username}\` bestaat niet.`,
    },
} as const;

export type BlueskyCommandConfig = typeof blueskyCommandConfig;
