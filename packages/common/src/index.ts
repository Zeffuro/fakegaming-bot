import * as Models from './models/index.js';
import * as Managers from './managers/index.js';
import * as Core from './core/index.js';
import * as Discord from './discord/index.js';

import { getSequelize } from './sequelize.js';
export { closeSequelize } from './sequelize.js';

import { cacheGet, cacheSet, cacheDel, ensureRedis } from './cache.js';
import { CACHE_KEYS, CACHE_TTL, getCacheManager, defaultCacheManager, type CacheManager } from './utils/cacheManager.js';
import { registerSchemaOverrides } from './validation/schemaOverrides.js';

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
  CacheConfig,
  Notification,
  DisabledModuleConfig,
  JobRun,
  TikTokStreamConfig
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
  DisabledCommandManager,
  NotificationsManager,
  TikTokManager
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
  getDiscordGuildChannels,
  getDiscordUserById,
  getDiscordGuildMember,
  getDiscordGuildMembersSearch
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
export type { DiscordUserProfile, DiscordGuildMemberMinimal } from './discord/types.js';
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
    zodSchemaToOpenApiSchema,
    mapSequelizeTypeToOpenAPI
} from './utils/openapi.js';

export { asValidated } from './utils/typeUtils.js';

export { SUPPORTED_GAMES } from './utils/supportedGames.js';

export { getLogger, createChildLogger, setLoggerLevel } from './utils/logger.js';
export { incMetric, getMetricsSnapshot, resetMetrics, startMetricsSummaryLogger } from './utils/metrics.js';

// Register custom create/update schema overrides (executed on module import)
registerSchemaOverrides();
export { PostgresRateLimiter, type RateLimiter, type RateLimiterResult } from './rate-limiter.js';

// Jobs interfaces
export * from './jobs/index.js';

// Patch notes fetchers (shared)
export * from './patchnotes/index.js';

// TikTok utilities (shared)
export * from './utils/tiktok.js';
