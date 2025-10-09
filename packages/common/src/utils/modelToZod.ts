import { z } from 'zod';
import { Model, ModelCtor } from 'sequelize-typescript';

/**
 * Maps Sequelize DataTypes to Zod schemas.
 * This is the core utility that maintains single source of truth.
 */
function mapDataTypeToZod(dataType: any, isOptional: boolean): z.ZodTypeAny {
    const typeStr = dataType?.toString() || '';

    let schema: z.ZodTypeAny;

    if (typeStr.includes('STRING') || typeStr.includes('TEXT')) {
        schema = z.string();
    } else if (typeStr.includes('INTEGER') || typeStr.includes('BIGINT')) {
        schema = z.number().int();
    } else if (typeStr.includes('FLOAT') || typeStr.includes('DOUBLE') || typeStr.includes('DECIMAL')) {
        schema = z.number();
    } else if (typeStr.includes('BOOLEAN')) {
        schema = z.boolean();
    } else if (typeStr.includes('DATE')) {
        schema = z.union([z.string().datetime(), z.date()]);
    } else if (typeStr.includes('JSON') || typeStr.includes('JSONB')) {
        schema = z.record(z.string(), z.any());
    } else {
        // Fallback for unknown types
        schema = z.any();
    }

    return isOptional ? schema.optional() : schema;
}

/**
 * Extract Zod schema from a Sequelize model.
 * This creates validation schemas automatically from your models.
 */
export function modelToZodSchema<T extends Model>(
    model: ModelCtor<T>,
    options: {
        mode?: 'create' | 'update' | 'full';
        omit?: string[];
        partial?: boolean;
    } = {}
): z.ZodObject<any> {
    const { mode = 'full', omit = [], partial = false } = options;

    const shape: Record<string, z.ZodTypeAny> = {};
    // Prefer getAttributes when available; fallback to rawAttributes
    const attributes: Record<string, any> | undefined = (model as any)?.getAttributes?.() ?? (model as any)?.rawAttributes;

    if (!attributes || Object.keys(attributes).length === 0) {
        // IMPORTANT: Use strict() instead of strip() to reject unknown fields with validation errors
        // This is safer than passthrough (which allowed everything) but better than strip (which silently removes)
        return z.object({}).strict();
    }

    for (const [key, attr] of Object.entries(attributes)) {
        // Skip if in omit list
        if (omit.includes(key)) continue;

        // For 'create' mode, skip ONLY auto-increment primary keys
        // Non-auto-increment PKs (like string IDs) should be allowed
        if (mode === 'create' && attr.primaryKey && attr.autoIncrement) {
            continue;
        }

        // Determine if field is optional
        const isOptional = attr.allowNull !== false || partial || mode === 'update';

        // Map the datatype to Zod
        shape[key] = mapDataTypeToZod(attr.type, isOptional);
    }

    return z.object(shape).strict();
}

/**
 * Generate a create schema (omits auto-generated fields like id, createdAt, updatedAt)
 */
export function createSchemaFromModel<T extends Model>(
    model: ModelCtor<T>,
    options: { omit?: string[] } = {}
): z.ZodObject<any> {
    // Do NOT omit primary key generically. Only skip auto-increment PKs above.
    const defaultOmit = ['createdAt', 'updatedAt'];
    return modelToZodSchema(model, {
        mode: 'create',
        omit: [...defaultOmit, ...(options.omit || [])],
    });
}

/**
 * Generate an update schema (all fields optional)
 */
export function updateSchemaFromModel<T extends Model>(
    model: ModelCtor<T>,
    options: { omit?: string[] } = {}
): z.ZodObject<any> {
    const defaultOmit = ['createdAt', 'updatedAt'];
    return modelToZodSchema(model, {
        mode: 'update',
        partial: true,
        omit: [...defaultOmit, ...(options.omit || [])],
    });
}

/**
 * Type helper to extract the inferred type from a Zod schema
 */
export type InferSchema<T> = T extends z.ZodType<infer U> ? U : never;
