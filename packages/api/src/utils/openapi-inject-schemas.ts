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
import { sequelizeModelToOpenAPISchema } from "./sequelize-to-openapi.js";

export function injectOpenApiSchemas(swaggerSpec: any) {
    swaggerSpec.components = swaggerSpec.components || {};
    swaggerSpec.components.schemas = {
        BirthdayConfig: sequelizeModelToOpenAPISchema(BirthdayConfig),
        CacheConfig: sequelizeModelToOpenAPISchema(CacheConfig),
        DisabledCommandConfig: sequelizeModelToOpenAPISchema(DisabledCommandConfig),
        PatchNoteConfig: sequelizeModelToOpenAPISchema(PatchNoteConfig),
        PatchSubscriptionConfig: sequelizeModelToOpenAPISchema(PatchSubscriptionConfig),
        QuoteConfig: sequelizeModelToOpenAPISchema(QuoteConfig),
        ReminderConfig: sequelizeModelToOpenAPISchema(ReminderConfig),
        ServerConfig: sequelizeModelToOpenAPISchema(ServerConfig),
        TwitchStreamConfig: sequelizeModelToOpenAPISchema(TwitchStreamConfig),
        UserConfig: sequelizeModelToOpenAPISchema(UserConfig),
        YoutubeVideoConfig: sequelizeModelToOpenAPISchema(YoutubeVideoConfig),
    };
    return swaggerSpec;
}