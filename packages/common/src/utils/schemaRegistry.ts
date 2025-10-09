import { z } from 'zod';
import { Model, ModelCtor } from 'sequelize-typescript';
import { createSchemaFromModel, updateSchemaFromModel, modelToZodSchema } from './modelToZod.js';

/**
 * Central registry for all model schemas.
 * Prevents duplication and ensures consistency.
 */
class SchemaRegistry {
    private createSchemas = new Map<string, z.ZodObject<any>>();
    private updateSchemas = new Map<string, z.ZodObject<any>>();
    private fullSchemas = new Map<string, z.ZodObject<any>>();

    /**
     * Get or create a schema for creating new records
     */
    getCreateSchema<T extends Model>(model: ModelCtor<T>): z.ZodObject<any> {
        const key = model.name;
        if (!this.createSchemas.has(key)) {
            this.createSchemas.set(key, createSchemaFromModel(model));
        }
        return this.createSchemas.get(key)!;
    }

    /**
     * Get or create a schema for updating records
     */
    getUpdateSchema<T extends Model>(model: ModelCtor<T>): z.ZodObject<any> {
        const key = model.name;
        if (!this.updateSchemas.has(key)) {
            this.updateSchemas.set(key, updateSchemaFromModel(model));
        }
        return this.updateSchemas.get(key)!;
    }

    /**
     * Get or create a full schema (all fields)
     */
    getFullSchema<T extends Model>(model: ModelCtor<T>): z.ZodObject<any> {
        const key = model.name;
        if (!this.fullSchemas.has(key)) {
            this.fullSchemas.set(key, modelToZodSchema(model));
        }
        return this.fullSchemas.get(key)!;
    }

    /**
     * Register a custom schema override
     */
    registerCustom<T extends Model>(
        model: ModelCtor<T>,
        type: 'create' | 'update' | 'full',
        schema: z.ZodObject<any>
    ): void {
        const key = model.name;
        const map = type === 'create' ? this.createSchemas :
                    type === 'update' ? this.updateSchemas :
                    this.fullSchemas;
        map.set(key, schema);
    }

    /**
     * Clear all cached schemas (useful for testing)
     */
    clear(): void {
        this.createSchemas.clear();
        this.updateSchemas.clear();
        this.fullSchemas.clear();
    }
}

export const schemaRegistry = new SchemaRegistry();

