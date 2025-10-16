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
    YoutubeVideoConfig,
    DisabledModuleConfig
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
        DisabledModuleConfig: modelToOpenApiSchema(DisabledModuleConfig, { mode: 'full' }),
        PatchNoteConfig: modelToOpenApiSchema(PatchNoteConfig, { mode: 'full' }),
        PatchSubscriptionConfig: modelToOpenApiSchema(PatchSubscriptionConfig, { mode: 'full' }),
        QuoteConfig: modelToOpenApiSchema(QuoteConfig, { mode: 'full' }),
        ReminderConfig: modelToOpenApiSchema(ReminderConfig, { mode: 'full' }),
        ServerConfig: modelToOpenApiSchema(ServerConfig, { mode: 'full' }),
        TwitchStreamConfig: modelToOpenApiSchema(TwitchStreamConfig, { mode: 'full' }),
        UserConfig: modelToOpenApiSchema(UserConfig, { mode: 'full' }),
        YoutubeVideoConfig: modelToOpenApiSchema(YoutubeVideoConfig, { mode: 'full' }),
        RateLimitError: {
            type: 'object',
            properties: {
                error: {
                    type: 'object',
                    properties: {
                        code: { type: 'string', example: 'RATE_LIMIT' },
                        message: { type: 'string', example: 'Rate limit exceeded' },
                        retryAfterSeconds: { type: 'integer', minimum: 1 }
                    },
                    required: ['code', 'message', 'retryAfterSeconds']
                }
            },
            required: ['error']
        }
    };
    // Add header components & a reusable 429 response
    swaggerSpec.components.headers = Object.assign({}, swaggerSpec.components.headers, {
        'X-RateLimit-Limit': { description: 'Maximum number of requests allowed in the current window', schema: { type: 'integer' } },
        'X-RateLimit-Remaining': { description: 'Remaining requests in the current window', schema: { type: 'integer' } },
        'X-RateLimit-Reset': { description: 'Unix epoch seconds when the current window resets', schema: { type: 'integer' } },
        'Retry-After': { description: 'Seconds to wait before retrying when limited', schema: { type: 'integer' } }
    });
    swaggerSpec.components.responses = Object.assign({}, swaggerSpec.components.responses, {
        RateLimitExceeded: {
            description: 'Rate limit exceeded',
            headers: {
                'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
                'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
                'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
                'Retry-After': { $ref: '#/components/headers/Retry-After' }
            },
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/RateLimitError' }
                }
            }
        }
    });
    return swaggerSpec;
}