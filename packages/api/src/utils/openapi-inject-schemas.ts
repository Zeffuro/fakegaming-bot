import {
    BirthdayConfig,
    CacheConfig,
    DisabledCommandConfig,
    PatchNoteConfig,
    PatchSubscriptionConfig,
    QuoteConfig,
    ReminderConfig,
    ServerConfig,
    TwitchStreamConfig,
    UserConfig,
    YoutubeVideoConfig
} from "@zeffuro/fakegaming-common/models";
import { modelToOpenApiSchema } from "@zeffuro/fakegaming-common/utils";

export function injectOpenApiSchemas(swaggerSpec: any) {
    swaggerSpec.components = swaggerSpec.components || {};
    const existing = swaggerSpec.components.schemas || {};
    swaggerSpec.components.schemas = {
        // Preserve any schemas already discovered by swagger-jsdoc in route annotations
        ...existing,
        // Merge in model schemas
        BirthdayConfig: modelToOpenApiSchema(BirthdayConfig, { mode: 'full' }),
        CacheConfig: modelToOpenApiSchema(CacheConfig, { mode: 'full' }),
        DisabledCommandConfig: modelToOpenApiSchema(DisabledCommandConfig, { mode: 'full' }),
        PatchNoteConfig: modelToOpenApiSchema(PatchNoteConfig, { mode: 'full' }),
        PatchSubscriptionConfig: modelToOpenApiSchema(PatchSubscriptionConfig, { mode: 'full' }),
        QuoteConfig: modelToOpenApiSchema(QuoteConfig, { mode: 'full' }),
        ReminderConfig: modelToOpenApiSchema(ReminderConfig, { mode: 'full' }),
        ServerConfig: modelToOpenApiSchema(ServerConfig, { mode: 'full' }),
        TwitchStreamConfig: modelToOpenApiSchema(TwitchStreamConfig, { mode: 'full' }),
        UserConfig: modelToOpenApiSchema(UserConfig, { mode: 'full' }),
        YoutubeVideoConfig: modelToOpenApiSchema(YoutubeVideoConfig, { mode: 'full' }),
    };
    return swaggerSpec;
}