import {z} from 'zod';
import type {Model, ModelCtor} from 'sequelize-typescript';
import {schemaRegistry} from './schemaRegistry.js';
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

function mapSequelizeTypeToOpenAPI(type: any): { type: string; format?: string } {
    const typeName = type?.constructor?.name || '';
    switch (typeName) {
        case 'STRING':
        case 'TEXT':
        case 'UUID':
            return { type: 'string' };
        case 'INTEGER':
        case 'BIGINT':
            return { type: 'integer', format: 'int64' };
        case 'FLOAT':
        case 'DOUBLE':
        case 'DECIMAL':
            return { type: 'number', format: 'float' };
        case 'BOOLEAN':
            return { type: 'boolean' };
        case 'DATE':
            return { type: 'string', format: 'date-time' };
        default:
            return { type: 'string' };
    }
}

function deriveOpenApiFromSequelize<T extends Model>(model: ModelCtor<T>): Record<string, unknown> | null {
    const attributes: Record<string, any> | undefined = (model as any)?.getAttributes?.() ?? (model as any)?.rawAttributes;
    if (!attributes || Object.keys(attributes).length === 0) return null;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [name, attr] of Object.entries(attributes)) {
        const typeInfo = mapSequelizeTypeToOpenAPI((attr as any).type);
        properties[name] = { ...typeInfo };
        if ((attr as any).allowNull === false || (attr as any).primaryKey) {
            required.push(name);
        }
    }
    return {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
    };
}

/**
 * Convert a Zod schema to an OpenAPI 3.0 SchemaObject using @asteasolutions/zod-to-openapi.
 */
export function zodSchemaToOpenApiSchema<T extends z.ZodTypeAny>(schema: T): Record<string, unknown> {
    const registry = new OpenAPIRegistry();
    const componentName = 'InlineSchema';
    registry.register(componentName, schema);
    const generator = new OpenApiGeneratorV3(registry.definitions);
    const doc = generator.generateDocument({
        openapi: '3.0.3',
        info: { title: 'inline', version: '1.0.0' },
    });
    const schemas = doc.components?.schemas as Record<string, unknown> | undefined;
    return (schemas && schemas[componentName] ? schemas[componentName] : { type: 'object', properties: {} }) as Record<string, unknown>;
}

/**
 * Create an OpenAPI schema from a Sequelize model by first deriving the Zod schema
 * via the central Schema Registry, then converting to an OpenAPI SchemaObject.
 * If Zod cannot infer (e.g., models not initialized), fall back to Sequelize attribute mapping.
 */
export function modelToOpenApiSchema<T extends Model>(
    model: ModelCtor<T>,
    options: { mode?: 'create' | 'update' | 'full' } = {}
): Record<string, unknown> {
    const mode = options.mode ?? 'full';

    try {
        const zodSchema = mode === 'create'
            ? schemaRegistry.getCreateSchema(model)
            : mode === 'update'
                ? schemaRegistry.getUpdateSchema(model)
                : schemaRegistry.getFullSchema(model);
        const schemaObj = zodSchemaToOpenApiSchema(zodSchema);
        // Validate it's an object schema with properties
        const isObjectSchema = schemaObj && typeof schemaObj === 'object' && (schemaObj as any).type === 'object';
        if (isObjectSchema) return schemaObj;
    } catch {
    }

    const fallback = deriveOpenApiFromSequelize(model);
    return fallback ?? { type: 'object', properties: {} };
}
