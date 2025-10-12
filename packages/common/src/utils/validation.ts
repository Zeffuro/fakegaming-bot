import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import type { Model, ModelCtor } from 'sequelize-typescript';
import { schemaRegistry } from './schemaRegistry.js';

/**
 * Format Zod issues into a consistent array of { path, message }
 */
export function formatZodError(
    issues: ReadonlyArray<{ path: ReadonlyArray<string | number>; message: string }>
): Array<{ path: string; message: string }> {
    return issues.map((e) => ({
        path: e.path.map((seg) => String(seg)).join('.'),
        message: e.message,
    }));
}

/**
 * Create an Express validator middleware from a parse function and an apply function.
 * Ensures consistent try/catch and error payloads.
 */
export function makeValidator<TParsed>(
    parseFn: (input: unknown) => Promise<TParsed>,
    applyFn: (req: Request, parsed: TParsed) => void,
    label: 'Body' | 'Query' | 'Params'
) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = await parseFn(getSourceByLabel(req, label));
            applyFn(req, parsed);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const issues = (error as unknown as {
                    issues: ReadonlyArray<{ path: ReadonlyArray<string | number>; message: string }>;
                }).issues;
                res.status(400).json({
                    error: `${label} validation failed`,
                    details: formatZodError(issues),
                });
                return;
            }
            next(error as Error);
        }
    };
}

function getSourceByLabel(req: Request, label: 'Body' | 'Query' | 'Params'): unknown {
    switch (label) {
        case 'Body':
            return req.body;
        case 'Query':
            return req.query;
        case 'Params':
            return req.params;
    }
}

/**
 * Validation middleware that uses Zod schemas.
 * This ensures runtime type safety derived from your models.
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
    return makeValidator(
        (input) => schema.parseAsync(input),
        (req, parsed) => {
            req.body = parsed as unknown;
        },
        'Body'
    );
}

/**
 * Lazy validation for request body using a Sequelize model schema.
 * The Zod schema is resolved at request time, ensuring models are initialized.
 */
export function validateBodyForModel<T extends Model>(
    model: ModelCtor<T>,
    type: 'create' | 'update' | 'full' = 'full'
) {
    return makeValidator(
        async (input) => {
            const schema =
                type === 'create'
                    ? schemaRegistry.getCreateSchema(model)
                    : type === 'update'
                        ? schemaRegistry.getUpdateSchema(model)
                        : schemaRegistry.getFullSchema(model);
            return schema.parseAsync(input);
        },
        (req, parsed) => {
            req.body = parsed as unknown;
        },
        'Body'
    );
}

/**
 * Validate query parameters
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
    return makeValidator(
        (input) => schema.parseAsync(input),
        (req, parsed) => {
            // Express' req.query is read-only type, so assign properties
            if (parsed && typeof parsed === 'object') {
                const record = parsed as Record<string, unknown>;
                Object.keys(record).forEach((key) => {
                    (req.query as Record<string, unknown>)[key] = record[key];
                });
            }
        },
        'Query'
    );
}

/**
 * Validate route parameters
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
    return makeValidator(
        (input) => schema.parseAsync(input),
        (req, parsed) => {
            req.params = parsed as unknown as Request['params'];
        },
        'Params'
    );
}
