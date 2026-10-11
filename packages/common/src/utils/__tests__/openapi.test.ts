import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import openapiTS, { astToString, type OpenAPI3 } from 'openapi-typescript';
import ts from 'typescript';
import path from 'node:path';
import { UserConfig } from '../../models/user-config.js';
import { modelToOpenApiSchema, zodSchemaToOpenApiSchema } from '../openapi.js';
import { schemaRegistry } from '../schemaRegistry.js';

const request = z.object({
    quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    recurrenceUnit: z.enum(['day', 'week']).nullable().optional(),
    choice: z.union([z.literal('automatic'), z.number().int().min(0)]),
});

function assertOpenApiTypes(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
        for (const item of value) assertOpenApiTypes(item);
        return;
    }
    const object = value as Record<string, unknown>;
    if ('type' in object) {
        expect(typeof object.type).toBe('string');
        expect(object.type).not.toBe('null');
    }
    expect(object).not.toHaveProperty('$schema');
    expect(object).not.toHaveProperty('const');
    for (const child of Object.values(object)) assertOpenApiTypes(child);
}

function document(schema: Record<string, unknown>): OpenAPI3 {
    return { openapi: '3.0.0', info: { title: 'Conversion regression', version: '1' },
        paths: {}, components: { schemas: { Request: schema } } } as unknown as OpenAPI3;
}

describe('OpenAPI 3.0 schema conversion', () => {
    it('represents nullability, enum values and union literals with OpenAPI 3.0 syntax', () => {
        const converted = zodSchemaToOpenApiSchema(request);
        expect(converted).toMatchObject({ type: 'object', required: ['choice'], properties: {
            quietHoursStart: { type: 'string', nullable: true, pattern: '^\\d{2}:\\d{2}$' },
            recurrenceUnit: { type: 'string', nullable: true, enum: ['day', 'week', null] },
            choice: { anyOf: [{ type: 'string', enum: ['automatic'] }, { type: 'integer', minimum: 0 }] },
        } });
        assertOpenApiTypes(converted);
    });

    it('preserves generated TypeScript contracts when replacing JSON Schema syntax', async () => {
        const { $schema: _schema, ...previous } = z.toJSONSchema(request);
        const before = astToString(await openapiTS(document(previous)));
        const after = astToString(await openapiTS(document(zodSchemaToOpenApiSchema(request))));
        const source = `declare namespace Before { ${before} }
            declare namespace After { ${after} }
            type BeforeRequest = Before.components["schemas"]["Request"];
            type AfterRequest = After.components["schemas"]["Request"];
            const compatible: BeforeRequest extends AfterRequest
                ? AfterRequest extends BeforeRequest ? true : false : false = true;
            const nullableRequest: AfterRequest = { choice: 1, recurrenceUnit: null, quietHoursStart: null };
            const literalRequest: AfterRequest = { choice: "automatic", recurrenceUnit: "day" };`;
        const filename = path.resolve('openapi-conversion-contract.ts').replace(/\\/g, '/');
        const options: ts.CompilerOptions = { strict: true, noEmit: true, types: [], skipLibCheck: true };
        const host = ts.createCompilerHost(options);
        const readSource = host.getSourceFile.bind(host);
        host.getSourceFile = (file, language, onError, newSource) => file === filename
            ? ts.createSourceFile(file, source, language, true)
            : readSource(file, language, onError, newSource);
        const program = ts.createProgram([filename], options, host);
        expect(ts.getPreEmitDiagnostics(program).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([]);
        expect(after).toContain('recurrenceUnit?: "day" | "week" | null');
        expect(after).toContain('quietHoursStart?: string | null');
        expect(after).toContain('choice: "automatic" | number');
    });

    it('keeps Sequelize DATE fields on the established date-time fallback', () => {
        expect(schemaRegistry.getFullSchema(UserConfig).shape.createdAt?.safeParse(new Date()).success).toBe(true);
        expect(() => zodSchemaToOpenApiSchema(z.object({ createdAt: z.date() }))).toThrow();
        const converted = modelToOpenApiSchema(UserConfig);
        expect(converted).toMatchObject({ type: 'object', properties: {
            discordId: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' },
        } });
        expect(converted.required).toContain('discordId');
        assertOpenApiTypes(converted);
    });
});
