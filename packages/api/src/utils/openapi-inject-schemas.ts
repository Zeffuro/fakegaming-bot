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
    DisabledModuleConfig,
    TikTokStreamConfig,
    BlueskyPostConfig
} from "@zeffuro/fakegaming-common/models";
import { apiRequestSchemas } from "@zeffuro/fakegaming-common/api";
import { modelToOpenApiSchema, zodSchemaToOpenApiSchema } from "@zeffuro/fakegaming-common/utils";
import type { Model, ModelCtor } from "sequelize-typescript";

type SchemaSource = readonly [name: string, model: ModelCtor<Model>];
type OpenApiComponents = {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    responses?: Record<string, unknown>;
};

type OpenApiDocument = {
    components?: OpenApiComponents;
    [key: string]: unknown;
};

const modelSchemaSources: SchemaSource[] = [
    ['BirthdayConfig', BirthdayConfig as ModelCtor<Model>],
    ['CacheConfig', CacheConfig as ModelCtor<Model>],
    ['DisabledCommandConfig', DisabledCommandConfig as ModelCtor<Model>],
    ['DisabledModuleConfig', DisabledModuleConfig as ModelCtor<Model>],
    ['PatchNoteConfig', PatchNoteConfig as ModelCtor<Model>],
    ['PatchSubscriptionConfig', PatchSubscriptionConfig as ModelCtor<Model>],
    ['QuoteConfig', QuoteConfig as ModelCtor<Model>],
    ['ReminderConfig', ReminderConfig as ModelCtor<Model>],
    ['ServerConfig', ServerConfig as ModelCtor<Model>],
    ['TwitchStreamConfig', TwitchStreamConfig as ModelCtor<Model>],
    ['TikTokStreamConfig', TikTokStreamConfig as ModelCtor<Model>],
    ['BlueskyPostConfig', BlueskyPostConfig as ModelCtor<Model>],
    ['UserConfig', UserConfig as ModelCtor<Model>],
    ['YoutubeVideoConfig', YoutubeVideoConfig as ModelCtor<Model>],
];

function buildModelSchemas(): Record<string, unknown> {
    const schemas: Record<string, unknown> = {};

    for (const [name, model] of modelSchemaSources) {
        schemas[name] = modelToOpenApiSchema(model, { mode: 'full' });
    }

    return schemas;
}

function buildApiRequestSchemas(): Record<string, unknown> {
    const schemas: Record<string, unknown> = {};

    for (const [name, schema] of Object.entries(apiRequestSchemas)) {
        schemas[name] = zodSchemaToOpenApiSchema(schema);
    }

    return schemas;
}

export function injectOpenApiSchemas(swaggerSpec: OpenApiDocument) {
    swaggerSpec.components = swaggerSpec.components || {};
    // Ensure bearer security scheme exists for protected routes
    swaggerSpec.components.securitySchemes = Object.assign({}, swaggerSpec.components.securitySchemes, {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    });
    const existing = swaggerSpec.components.schemas || {};
    swaggerSpec.components.schemas = {
        // Preserve any schemas already discovered by swagger-jsdoc in route annotations
        ...existing,
        // Common error envelope used across the API
        ErrorResponse: {
            type: 'object',
            properties: {
                error: {
                    type: 'object',
                    properties: {
                        code: { type: 'string', example: 'BAD_REQUEST' },
                        message: { type: 'string', example: 'Body validation failed' },
                        details: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['code', 'message']
                }
            },
            required: ['error']
        },
        // Full model schemas describe persisted responses; request DTOs are explicit Zod contracts.
        ...buildModelSchemas(),
        ...buildApiRequestSchemas(),
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
    // Add header components & reusable responses
    swaggerSpec.components.headers = Object.assign({}, swaggerSpec.components.headers, {
        'X-RateLimit-Limit': { description: 'Maximum number of requests allowed in the current window', schema: { type: 'integer' } },
        'X-RateLimit-Remaining': { description: 'Remaining requests in the current window', schema: { type: 'integer' } },
        'X-RateLimit-Reset': { description: 'Unix epoch seconds when the current window resets', schema: { type: 'integer' } },
        'Retry-After': { description: 'Seconds to wait before retrying when limited', schema: { type: 'integer' } }
    });
    swaggerSpec.components.responses = Object.assign({}, swaggerSpec.components.responses, {
        BadRequest: {
            description: 'Validation failed',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
        },
        Unauthorized: {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
        },
        Forbidden: {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
        },
        NotFound: {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
        },
        Conflict: {
            description: 'Conflict',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
        },
        RateLimitExceeded: {
            description: 'Rate limit exceeded',
            headers: {
                'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
                'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
                'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
                'Retry-After': { $ref: '#/components/headers/Retry-After' }
            },
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RateLimitError' } } }
        }
    });
    return swaggerSpec;
}
