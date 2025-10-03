// Import from sub-entry points
import * as Models from './models/index.js';
import * as Managers from './managers/index.js';
import * as Core from './core/index.js';
import * as Discord from './discord/index.js';

// Sequelize - fixed import names
import { getSequelize } from './sequelize.js';

// Cache utilities
import { cacheGet, cacheSet, cacheDel, ensureRedis } from './cache.js';
import { CACHE_KEYS, CACHE_TTL, getCacheManager, defaultCacheManager, type CacheManager } from './utils/cacheManager.js';

// Export all models
export {
  Models
};

// Re-export individual models for backward compatibility
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

// Export all managers as a namespace
export {
  Managers
};

// Re-export individual managers for backward compatibility
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

// Export core utilities as a namespace
export {
  Core
};

// Re-export individual core utilities for backward compatibility
export {
  bootstrapEnv,
  // Fixed core exports based on actual exports
  PROJECT_ROOT
} from './core/index.js';

// Export Discord utilities as a namespace
export {
  Discord
};

// Re-export individual Discord auth utilities with the correct names
export {
  // Export the actual functions that are available
  getDiscordGuilds,
  exchangeCodeForToken,
  fetchDiscordUser,
  getDiscordOAuthUrl,
  issueJwt,
  verifyJwt,
  getDiscordGuildChannels
} from './discord/index.js';

// Export sequelize - fixed to use getSequelize
export {
  getSequelize
};

// Export cache utilities
export {
  // Low-level cache functions
  cacheGet,
  cacheSet,
  cacheDel,
  ensureRedis,
  // Cache manager
  CACHE_KEYS,
  CACHE_TTL,
  getCacheManager,
  defaultCacheManager,
  type CacheManager
};

// For backward compatibility, export getCachedData function
export const getCachedData = defaultCacheManager.getCachedData.bind(defaultCacheManager);

// Export Discord types
export type { MinimalGuildData } from './discord/types.js';

// Export permission utilities
export { isGuildAdmin, checkGuildAccess, DISCORD_PERMISSION_ADMINISTRATOR } from './utils/permissionUtils.js';
