import { schemaRegistry } from '../utils/schemaRegistry.js';
import {
    BlueskyPostConfig,
    DisabledCommandConfig,
    DisabledModuleConfig,
    PatchSubscriptionConfig,
    QuoteConfig,
    ReminderConfig,
    TikTokStreamConfig,
    TwitchStreamConfig,
    YoutubeVideoConfig,
} from '../models/index.js';
import {
    blueskyCreateRequestSchema,
    blueskyUpdateRequestSchema,
    disabledCommandCreateRequestSchema,
    disabledModuleCreateRequestSchema,
    patchSubscriptionRequestSchema,
    quoteCreateRequestSchema,
    reminderCreateRequestSchema,
    tiktokCreateRequestSchema,
    tiktokUpdateRequestSchema,
    twitchCreateRequestSchema,
    twitchUpdateRequestSchema,
    youtubeCreateRequestSchema,
    youtubeUpdateRequestSchema,
} from '../api/schemas.js';

/** Register all custom Zod schema overrides for Sequelize models. */
export function registerSchemaOverrides(): void {
    schemaRegistry.registerCustom(PatchSubscriptionConfig, 'create', patchSubscriptionRequestSchema);
    schemaRegistry.registerCustom(QuoteConfig, 'create', quoteCreateRequestSchema);
    schemaRegistry.registerCustom(ReminderConfig, 'create', reminderCreateRequestSchema);
    schemaRegistry.registerCustom(DisabledCommandConfig, 'create', disabledCommandCreateRequestSchema);
    schemaRegistry.registerCustom(DisabledModuleConfig, 'create', disabledModuleCreateRequestSchema);
    schemaRegistry.registerCustom(TwitchStreamConfig, 'create', twitchCreateRequestSchema);
    schemaRegistry.registerCustom(TwitchStreamConfig, 'update', twitchUpdateRequestSchema);
    schemaRegistry.registerCustom(YoutubeVideoConfig, 'create', youtubeCreateRequestSchema);
    schemaRegistry.registerCustom(YoutubeVideoConfig, 'update', youtubeUpdateRequestSchema);
    schemaRegistry.registerCustom(TikTokStreamConfig, 'create', tiktokCreateRequestSchema);
    schemaRegistry.registerCustom(TikTokStreamConfig, 'update', tiktokUpdateRequestSchema);
    schemaRegistry.registerCustom(BlueskyPostConfig, 'create', blueskyCreateRequestSchema);
    schemaRegistry.registerCustom(BlueskyPostConfig, 'update', blueskyUpdateRequestSchema);
}
