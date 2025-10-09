// Type definitions for @zeffuro/fakegaming-common

// Models namespace
export namespace Models {
    export * from './models/index.js';
}

// Individual model exports
export {
    UserConfig,
    UserConfigCreationAttributes,
    LeagueConfig,
    ServerConfig,
    QuoteConfig,
    TwitchStreamConfig,
    YoutubeVideoConfig,
    ReminderConfig,
    BirthdayConfig,
    PatchNoteConfig,
    PatchSubscriptionConfig,
    DisabledCommandConfig,
    CacheConfig
} from './models/index.js';

// Managers namespace
export namespace Managers {
    export * from './managers/index.js';
}

// Individual manager exports
export {
    getConfigManager,
    ConfigManager,
    BaseManager,
    UserManager,
    ServerManager,
    QuoteManager,
    TwitchManager,
    YoutubeManager,
    ReminderManager,
    BirthdayManager,
    PatchNotesManager,
    DisabledCommandManager
} from './managers/index.js';

// Core namespace
export namespace Core {
    export * from './core/index.js';
}

// Individual core exports
export {
    bootstrapEnv,
    getDataRoot,
    getProjectRoot
} from './core/index.js';

// Discord namespace
export namespace Discord {
  // Re-export all discord types
  export * from './discord/index.js';
}

// Individual Discord auth exports
export {
    exchangeCode,
    refreshToken,
    revokeToken,
    getDiscordUserInfo,
    getDiscordUserGuilds,
    getDiscordOAuthUrl,
    issueJwt,
    verifyJwt,
} from './discord/index.js';

// Sequelize exports
export { sequelize, initSequelize } from './sequelize.js';

// Runtime validation and schema helpers
export {
    modelToZodSchema,
    createSchemaFromModel,
    updateSchemaFromModel,
    type InferSchema
} from './utils/modelToZod.js';

export { schemaRegistry } from './utils/schemaRegistry.js';

export {
    validateBody,
    validateBodyForModel,
    validateQuery,
    validateParams
} from './utils/validation.js';

// Error helpers and permissions
export { ForbiddenError, NotFoundError } from './utils/apiErrorHelpers.js';
export { isGuildAdmin, checkGuildAccess, DISCORD_PERMISSION_ADMINISTRATOR } from './utils/permissionUtils.js';

// Cache utility surface matching index.ts
export {
    cacheGet,
    cacheSet,
    cacheDel,
    ensureRedis,
    CACHE_KEYS,
    CACHE_TTL,
    getCacheManager,
    defaultCacheManager,
    type CacheManager
} from './utils/cacheManager.js';

// Sequelize getter matching index.ts
export { getSequelize } from './sequelize.js';
