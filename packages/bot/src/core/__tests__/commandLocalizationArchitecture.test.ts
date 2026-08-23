import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';

const SOURCE_ROOT = path.resolve(import.meta.dirname, '../..');
const INLINE_LOCALIZATION_SETTER = /\.set(?:Name|Description)Localizations?\s*\(/;

describe('command localization architecture', () => {
    it('keeps Discord command localization in package catalogs', () => {
        const violations = listTypeScriptFiles(SOURCE_ROOT)
            .filter(file => INLINE_LOCALIZATION_SETTER.test(readFileSync(file, 'utf8')))
            .map(file => path.relative(SOURCE_ROOT, file));

        expect(violations).toEqual([]);
    });

    it('keeps canonical command names out of translator-owned catalog values', () => {
        const commandCatalogRoot = path.join(SOURCE_ROOT, 'messages');
        const violations = listJsonFiles(commandCatalogRoot)
            .filter(file => file.includes(`${path.sep}commands${path.sep}`))
            .flatMap(file => findTranslatableNames(JSON.parse(readFileSync(file, 'utf8')) as unknown)
                .map(key => `${path.relative(SOURCE_ROOT, file)}:${key}`));

        expect(violations).toEqual([]);
    });
});

function listTypeScriptFiles(directory: string): string[] {
    return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listTypeScriptFiles(entryPath);
        return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
    });
}

function listJsonFiles(directory: string): string[] {
    return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listJsonFiles(entryPath);
        return entry.isFile() && entry.name.endsWith('.json') ? [entryPath] : [];
    });
}

function findTranslatableNames(value: unknown, prefix = ''): string[] {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.entries(value).flatMap(([key, nested]) => {
        const pathKey = prefix ? `${prefix}.${key}` : key;
        if (key === 'name' && typeof nested === 'string') return [pathKey];
        return findTranslatableNames(nested, pathKey);
    });
}
