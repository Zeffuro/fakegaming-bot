import * as Models from './models/index.js';
import * as Managers from './managers/index.js';
import * as Core from './core/index.js';
import * as Discord from './discord/index.js';

import { getSequelize } from './sequelize.js';

import { cacheGet, cacheSet, cacheDel, ensureRedis } from './cache.js';
import { CACHE_KEYS, CACHE_TTL, getCacheManager, defaultCacheManager, type CacheManager } from './utils/cacheManager.js';

export {
  Models
};

export {
  UserConfig,
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

export {
  Managers
};

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

export {
  Core
};

export {
  bootstrapEnv,
  PROJECT_ROOT
} from './core/index.js';

export {
  Discord
};

export {
  getDiscordGuilds,
  exchangeCodeForToken,
  fetchDiscordUser,
  getDiscordOAuthUrl,
  issueJwt,
  verifyJwt,
  getDiscordGuildChannels
} from './discord/index.js';

export {
  getSequelize
};

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
};

export const getCachedData = defaultCacheManager.getCachedData.bind(defaultCacheManager);

export type { MinimalGuildData } from './discord/types.js';

export { isGuildAdmin, checkGuildAccess, DISCORD_PERMISSION_ADMINISTRATOR } from './utils/permissionUtils.js';
export { ForbiddenError, NotFoundError } from './utils/apiErrorHelpers.js';

export * from './utils/apiErrorHelpers.js';

export {
    modelToZodSchema,
    createSchemaFromModel,
    updateSchemaFromModel,
    type InferSchema
} from './utils/modelToZod.js';

export {
    schemaRegistry
} from './utils/schemaRegistry.js';

export {
    validateBody,
    validateBodyForModel,
    validateQuery,
    validateParams
} from './utils/validation.js';

export {
    modelToOpenApiSchema,
    zodSchemaToOpenApiSchema
} from './utils/openapi.js';
