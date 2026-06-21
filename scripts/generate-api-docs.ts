import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPENAPI_PATH = path.join(PROJECT_ROOT, 'packages/api/openapi.json');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'docs/generated/api.md');
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const;

type HttpMethod = typeof HTTP_METHODS[number];

interface OpenApiOperation {
    summary?: string;
    tags?: string[];
    security?: unknown[];
}

interface OpenApiSpec {
    paths?: Record<string, Record<string, unknown>>;
    security?: unknown[];
}

interface ApiDocRow {
    tag: string;
    method: string;
    path: string;
    summary: string;
    auth: string;
}

function isHttpMethod(value: string): value is HttpMethod {
    return HTTP_METHODS.includes(value as HttpMethod);
}

function isOperation(value: unknown): value is OpenApiOperation {
    return typeof value === 'object' && value !== null;
}

function methodRank(method: string): number {
    const index = HTTP_METHODS.indexOf(method.toLowerCase() as HttpMethod);
    return index === -1 ? HTTP_METHODS.length : index;
}

function escapeCell(value: string): string {
    return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function getAuthLabel(spec: OpenApiSpec, operation: OpenApiOperation): string {
    if (Array.isArray(operation.security) && operation.security.length === 0) {
        return 'None';
    }

    if (operation.security === undefined && Array.isArray(spec.security) && spec.security.length === 0) {
        return 'None';
    }

    return 'Bearer';
}

function getRows(spec: OpenApiSpec): ApiDocRow[] {
    const rows: ApiDocRow[] = [];

    for (const [routePath, pathItem] of Object.entries(spec.paths ?? {})) {
        for (const [method, value] of Object.entries(pathItem)) {
            if (!isHttpMethod(method) || !isOperation(value)) {
                continue;
            }

            rows.push({
                tag: value.tags?.[0] ?? 'Other',
                method: method.toUpperCase(),
                path: routePath,
                summary: value.summary ?? '',
                auth: getAuthLabel(spec, value),
            });
        }
    }

    return rows.sort((a, b) => {
        const byTag = a.tag.localeCompare(b.tag);
        if (byTag !== 0) return byTag;

        const byPath = a.path.localeCompare(b.path);
        if (byPath !== 0) return byPath;

        return methodRank(a.method) - methodRank(b.method);
    });
}

function readSpec(): OpenApiSpec {
    if (!fs.existsSync(OPENAPI_PATH)) {
        throw new Error(`Missing OpenAPI spec at ${OPENAPI_PATH}. Run pnpm --filter @zeffuro/fakegaming-bot-api run export:openapi first.`);
    }

    return JSON.parse(fs.readFileSync(OPENAPI_PATH, 'utf8')) as OpenApiSpec;
}

export function generateApiDocs(spec: OpenApiSpec): string {
    const rows = getRows(spec);
    if (rows.length === 0) {
        throw new Error('OpenAPI spec contains no documented operations.');
    }

    const lines = [
        '# API Routes',
        '',
        'Generated from `packages/api/openapi.json`. Do not edit by hand.',
        '',
        `Operations: ${rows.length}`,
        '',
        '| Tag | Method | Path | Summary | Auth |',
        '| --- | --- | --- | --- | --- |',
        ...rows.map((row) => `| ${escapeCell(row.tag)} | ${escapeCell(row.method)} | \`${escapeCell(row.path)}\` | ${escapeCell(row.summary)} | ${escapeCell(row.auth)} |`),
        '',
    ];

    return lines.join('\n');
}

function writeOrCheck(content: string, checkMode: boolean): void {
    const existing = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : null;

    if (checkMode) {
        if (existing !== content) {
            console.error('Generated API docs are out of date. Run: pnpm run gen:api-docs');
            process.exit(1);
        }

        console.log('Generated API docs are up-to-date.');
        return;
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, content, 'utf8');
    console.log(`Wrote generated API docs to ${OUTPUT_PATH}`);
}

function main(): void {
    const checkMode = process.argv.includes('--check');
    const spec = readSpec();
    const content = generateApiDocs(spec);
    writeOrCheck(content, checkMode);
}

main();
