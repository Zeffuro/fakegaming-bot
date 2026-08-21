import * as Models from './models/index.js';
import * as Managers from './managers/index.js';
import * as Core from './core/index.js';
import * as Discord from './discord/index.js';
import * as Api from './api/index.js';

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
  QuoteOfDayConfig,
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
  TikTokStreamConfig,
  BlueskyPostConfig,
  AnimeTitle,
  AnimeSubscriptionConfig,
  AnimeEpisode,
  AuditEvent,
  IntegrationHealth,
  SteamNewsSubscriptionConfig,
  UserDigestSubscriptionConfig,
  GuildLocaleConfig,
  GameNightSession,
  GameNightNomination,
  GameNightVote,
  VoiceChannelOccupancyConfig,
  type AuditActorType,
  type AuditEventSeverity,
  type AuditEventStatus,
  type AuditEventMetadata,
  type IntegrationHealthStatus,
  type IntegrationHealthMetadata
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
  QuoteOfDayManager,
  type QuoteOfDayConfigRecord,
  TwitchManager,
  YoutubeManager,
  ReminderManager,
  BirthdayManager,
  PatchNotesManager,
  DisabledCommandManager,
  NotificationsManager,
  type NotificationRecord,
  type NotificationListOptions,
  type UserBirthdayDeliveryListOptions,
  type NotificationProviderSummary,
  type NotificationListResult,
  TikTokManager,
  BlueskyManager,
  AnimeManager,
  AnimeTitleManager,
  AnimeSubscriptionManager,
  AnimeEpisodeManager,
  AuditEventManager,
  IntegrationHealthManager,
  SteamNewsSubscriptionManager,
  UserDigestSubscriptionManager,
  GuildLocaleConfigManager,
  type GuildLocaleConfigRecord,
  GameNightManager,
  VoiceChannelOccupancyConfigManager,
  type VoiceChannelOccupancyConfigRecord,
  GameNightError,
  GAME_NIGHT_DEFAULT_DURATION_HOURS,
  GAME_NIGHT_MAX_DURATION_HOURS,
  GAME_NIGHT_MAX_NAME_LENGTH,
  GAME_NIGHT_MIN_DURATION_HOURS,
  GAME_NIGHT_MAX_NOMINATIONS,
  GAME_NIGHT_MIN_NOMINATIONS,
  type GameNightBoard,
  type GameNightErrorCode,
  type AuditEventInput,
  type AuditEventRecord,
  type AuditEventListOptions,
  type AuditEventListResult,
  type IntegrationHealthRecord,
  type IntegrationHealthSuccessInput,
  type IntegrationHealthFailureInput,
  type IntegrationHealthStatusInput,
  type IntegrationHealthListOptions,
  type IntegrationHealthSummary,
  type IntegrationHealthListResult
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
  Api
};

export * from './api/index.js';

export {
  getDiscordGuilds,
  exchangeCodeForToken,
  refreshDiscordAccessToken,
  fetchDiscordUser,
  getDiscordOAuthUrl,
  issueJwt,
  verifyJwt,
  getDiscordGuildChannels,
  getDiscordUserById,
  getDiscordGuildMember,
  getDiscordGuildMembersSearch,
  permissionNamesFromBitfield,
  rolePermissionChannelKind,
  rolePermissionOverwriteType
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
    validateParams,
    type ValidationErrorPayload,
    type ValidatorOptions,
} from './utils/validation.js';

export {
    modelToOpenApiSchema,
    zodSchemaToOpenApiSchema,
    mapSequelizeTypeToOpenAPI
} from './utils/openapi.js';

export { asValidated } from './utils/typeUtils.js';

export { SUPPORTED_GAMES } from './utils/supportedGames.js';
export {
  SUPPORTED_OUTPUT_LOCALES,
  DEFAULT_OUTPUT_LOCALE,
  NON_DEFAULT_OUTPUT_LOCALES,
  OUTPUT_LOCALE_METADATA,
  getOutputLocaleMetadata,
  DEFAULT_LOCALE,
  LOCALE_METADATA,
  NON_DEFAULT_LOCALES,
  SUPPORTED_LOCALES,
  getLocaleMetadata,
  isSupportedLocale,
  isSupportedOutputLocale,
  resolveLocaleFromAcceptLanguage,
  resolveOutputLocaleFromAcceptLanguage,
  resolveLocaleValue,
  type LocaleMetadata,
  type OutputLocaleMetadata,
  type LocaleValues,
  type OutputLocaleValues,
  type SupportedLocale,
  type NonDefaultLocale,
  type NonDefaultOutputLocale,
  type SupportedOutputLocale
} from './utils/outputLocale.js';

export { getLogger, createChildLogger, setLoggerLevel } from './utils/logger.js';
export { incMetric, getMetricsSnapshot, resetMetrics, startMetricsSummaryLogger } from './utils/metrics.js';
export { sanitizeAuditMetadata } from './utils/auditMetadata.js';
export { parseRiotId, formatRiotId, type RiotIdParts } from './utils/riotId.js';
export {
    parseReminderRecurrence,
    getNextRecurringReminderTimestamp,
    formatReminderRecurrence,
    type ReminderRecurrenceRule,
    type ReminderRecurrenceUnit,
    type NextRecurringReminderInput
} from './utils/reminderRecurrence.js';
export {
    computeNextDigestRunAt,
    getDigestWindowMs,
    isValidDigestSchedule,
    normalizeDigestCategories,
    parseDigestCategories,
    serializeDigestCategories,
    type DigestCategory,
    type DigestFrequency,
    type NextDigestRunInput
} from './utils/digestSchedule.js';

// Register custom create/update schema overrides (executed on module import)
registerSchemaOverrides();
export { PostgresRateLimiter, type RateLimiter, type RateLimiterResult } from './rate-limiter.js';

// Jobs interfaces
export * from './jobs/index.js';

// Patch notes fetchers (shared)
export * from './patchnotes/index.js';

// Anime provider utilities (shared)
export * from './anime/index.js';

// Steam provider utilities (shared)
export * from './steam/index.js';

// TikTok utilities (shared)
export * from './utils/tiktok.js';
