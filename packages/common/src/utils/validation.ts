import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import type { Model, ModelCtor } from 'sequelize-typescript';
import { schemaRegistry } from './schemaRegistry.js';

/**
 * Validation middleware that uses Zod schemas.
 * This ensures runtime type safety derived from your models.
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            req.body = await schema.parseAsync(req.body);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Body validation failed',
                    details: error.issues.map(e => ({
                        path: e.path.join('.'),
                        message: e.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}

/**
 * Lazy validation for request body using a Sequelize model schema.
 * The Zod schema is resolved at request time, ensuring models are initialized.
 */
export function validateBodyForModel<T extends Model>(model: ModelCtor<T>, type: 'create' | 'update' | 'full' = 'full') {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const schema = type === 'create'
                ? schemaRegistry.getCreateSchema(model)
                : type === 'update'
                    ? schemaRegistry.getUpdateSchema(model)
                    : schemaRegistry.getFullSchema(model);
            req.body = await schema.parseAsync(req.body);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Body validation failed',
                    details: error.issues.map(e => ({
                        path: e.path.join('.'),
                        message: e.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}

/**
 * Validate query parameters
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const validated = await schema.parseAsync(req.query);
            // Don't reassign req.query directly - it's read-only in Express
            // Cast validated to a record type to satisfy TypeScript
            if (validated && typeof validated === 'object') {
                Object.keys(validated as Record<string, unknown>).forEach(key => {
                    (req.query as Record<string, unknown>)[key] = (validated as Record<string, unknown>)[key];
                });
            }
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Query validation failed',
                    details: error.issues.map(e => ({
                        path: e.path.join('.'),
                        message: e.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}

/**
 * Validate route parameters
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const validated = await schema.parseAsync(req.params);
            req.params = validated as unknown as Request['params'];
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Params validation failed',
                    details: error.issues.map(e => ({
                        path: e.path.join('.'),
                        message: e.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}
