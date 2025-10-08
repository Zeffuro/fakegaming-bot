import type { Request, Response, NextFunction } from 'express';
import type { Model, ModelCtor } from 'sequelize-typescript';
import { z } from 'zod';
import { schemaRegistry } from '@zeffuro/fakegaming-common';

/**
 * Validate request body against a model-derived Zod schema lazily.
 * This resolves the appropriate schema at request time to avoid init-order issues.
 */
export function validateBodyForModel<T extends Model>(
    model: ModelCtor<T>,
    type: 'create' | 'update' | 'full' = 'full'
) {
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
                    error: 'Validation failed',
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

