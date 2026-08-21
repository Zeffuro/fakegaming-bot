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
});

function listTypeScriptFiles(directory: string): string[] {
    return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listTypeScriptFiles(entryPath);
        return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
    });
}
