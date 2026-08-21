import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
    TYPE,
    parse,
    type MessageFormatElement,
    type PluralElement,
    type SelectElement,
} from '@formatjs/icu-messageformat-parser';
import {
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    type SupportedLocale,
} from '../packages/common/src/utils/outputLocale.js';

interface CatalogDefinition {
    name: string;
    root: string;
}

type CatalogLeaf =
    | { type: 'string'; value: string }
    | { type: 'number'; value: number }
    | { type: 'boolean'; value: boolean }
    | { type: 'null'; value: null };

type CatalogNodeType = 'object' | 'array' | 'leaf';

interface CatalogSnapshot {
    leaves: Map<string, CatalogLeaf>;
    nodes: Map<string, CatalogNodeType>;
}

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const catalogs: readonly CatalogDefinition[] = [
    { name: 'api', root: 'packages/api/src/localization/messages' },
    { name: 'bot', root: 'packages/bot/src/messages' },
    { name: 'common', root: 'packages/common/src/messages' },
    { name: 'dashboard', root: 'packages/dashboard/messages' },
];

async function main(): Promise<void> {
    const failures: string[] = [];
    let fileCount = 0;
    let messageCount = 0;

    for (const catalog of catalogs) {
        const sourceRoot = path.join(workspaceRoot, catalog.root, DEFAULT_LOCALE);
        const sourceFiles = await listJsonFiles(sourceRoot);
        if (sourceFiles.length === 0) {
            failures.push(`${catalog.name}: no ${DEFAULT_LOCALE} source catalogs found`);
            continue;
        }

        const localeFilesByLocale = new Map<SupportedLocale, Set<string>>();
        for (const locale of SUPPORTED_LOCALES) {
            const localeRoot = path.join(workspaceRoot, catalog.root, locale);
            const localeFiles = await listJsonFiles(localeRoot);
            localeFilesByLocale.set(locale, new Set(localeFiles));
            compareLists(
                sourceFiles,
                localeFiles,
                `${catalog.name}:${locale}:files`,
                failures,
            );
        }

        for (const relativeFile of sourceFiles) {
            const source = await readCatalog(path.join(sourceRoot, relativeFile));
            const sourceSnapshot = flattenCatalog(source);
            const sourceLeaves = sourceSnapshot.leaves;
            fileCount += 1;
            messageCount += [...sourceLeaves.values()].filter(leaf => leaf.type === 'string').length;

            validateIcuMessages(sourceLeaves, `${catalog.name}:${DEFAULT_LOCALE}:${relativeFile}`, failures);

            for (const locale of SUPPORTED_LOCALES) {
                if (locale === DEFAULT_LOCALE) continue;
                if (!localeFilesByLocale.get(locale)?.has(relativeFile)) continue;
                const translationPath = path.join(workspaceRoot, catalog.root, locale, relativeFile);
                const translation = await readCatalog(translationPath);
                const translationSnapshot = flattenCatalog(translation);
                const translationLeaves = translationSnapshot.leaves;
                const context = `${catalog.name}:${locale}:${relativeFile}`;

                compareCatalogShape(sourceSnapshot, translationSnapshot, context, failures);
                for (const [key, sourceLeaf] of sourceLeaves) {
                    const translatedLeaf = translationLeaves.get(key);
                    if (!translatedLeaf || translatedLeaf.type !== sourceLeaf.type) {
                        failures.push(`${context}:${key}: expected ${sourceLeaf.type}, received ${translatedLeaf?.type ?? 'missing'}`);
                        continue;
                    }
                    if (sourceLeaf.type !== 'string' || translatedLeaf.type !== 'string') continue;
                    if (!translatedLeaf.value.trim()) {
                        failures.push(`${context}:${key}: translation is empty`);
                        continue;
                    }
                    compareIcuArguments(sourceLeaf.value, translatedLeaf.value, `${context}:${key}`, failures);
                }
                validateIcuMessages(translationLeaves, context, failures);
            }
        }
    }

    if (failures.length > 0) {
        throw new Error(`i18n validation failed:\n${failures.map(failure => `- ${failure}`).join('\n')}`);
    }

    console.log(`Validated ${fileCount} source catalogs and ${messageCount} source messages across ${SUPPORTED_LOCALES.length} locales.`);
}

async function listJsonFiles(root: string): Promise<string[]> {
    const files: string[] = [];
    await walk(root, '');
    return files.sort();

    async function walk(directory: string, relativeDirectory: string): Promise<void> {
        let entries;
        try {
            entries = await readdir(directory, { withFileTypes: true });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
            throw error;
        }
        for (const entry of entries) {
            const relativePath = path.join(relativeDirectory, entry.name);
            if (entry.isDirectory()) {
                await walk(path.join(directory, entry.name), relativePath);
            } else if (entry.isFile() && entry.name.endsWith('.json')) {
                files.push(relativePath);
            }
        }
    }
}

async function readCatalog(filePath: string): Promise<unknown> {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function flattenCatalog(value: unknown): CatalogSnapshot {
    const leaves = new Map<string, CatalogLeaf>();
    const nodes = new Map<string, CatalogNodeType>();
    visit(value, '');
    return { leaves, nodes };

    function visit(current: unknown, prefix: string): void {
        if (Array.isArray(current)) {
            nodes.set(prefix, 'array');
            current.forEach((entry, index) => visit(entry, `${prefix}[${index}]`));
            return;
        }
        if (current && typeof current === 'object') {
            nodes.set(prefix, 'object');
            for (const [key, nested] of Object.entries(current)) {
                visit(nested, prefix ? `${prefix}.${key}` : key);
            }
            return;
        }
        nodes.set(prefix, 'leaf');
        if (current === null) leaves.set(prefix, { type: 'null', value: null });
        else if (typeof current === 'string') leaves.set(prefix, { type: 'string', value: current });
        else if (typeof current === 'number') leaves.set(prefix, { type: 'number', value: current });
        else if (typeof current === 'boolean') leaves.set(prefix, { type: 'boolean', value: current });
        else throw new Error(`Unsupported catalog value at ${prefix || '<root>'}: ${typeof current}`);
    }
}

function compareCatalogShape(
    source: CatalogSnapshot,
    translated: CatalogSnapshot,
    context: string,
    failures: string[],
): void {
    compareLists([...source.nodes.keys()], [...translated.nodes.keys()], `${context}:keys`, failures);
    for (const [key, sourceType] of source.nodes) {
        const translatedType = translated.nodes.get(key);
        if (translatedType && translatedType !== sourceType) {
            failures.push(`${context}:${key || '<root>'}: expected ${sourceType}, received ${translatedType}`);
        }
    }
}

function compareLists(source: readonly string[], translated: readonly string[], context: string, failures: string[]): void {
    const expected = [...source].sort();
    const actual = [...translated].sort();
    const missing = expected.filter(value => !actual.includes(value));
    const extra = actual.filter(value => !expected.includes(value));
    if (missing.length > 0) failures.push(`${context}: missing ${missing.join(', ')}`);
    if (extra.length > 0) failures.push(`${context}: unexpected ${extra.join(', ')}`);
}

function validateIcuMessages(leaves: ReadonlyMap<string, CatalogLeaf>, context: string, failures: string[]): void {
    for (const [key, leaf] of leaves) {
        if (leaf.type !== 'string') continue;
        try {
            const elements = parse(leaf.value);
            const positionalArguments = collectIcuArguments(elements)
                .filter(name => /^value\d+$/.test(name));
            if (positionalArguments.length > 0) {
                failures.push(
                    `${context}:${key}: use semantic ICU argument names instead of ${positionalArguments.join(', ')}`,
                );
            }
        } catch (error) {
            failures.push(`${context}:${key}: invalid ICU message (${error instanceof Error ? error.message : String(error)})`);
        }
    }
}

function compareIcuArguments(source: string, translation: string, context: string, failures: string[]): void {
    try {
        const expected = collectIcuArguments(parse(source));
        const actual = collectIcuArguments(parse(translation));
        compareLists(expected, actual, `${context}:arguments`, failures);
    } catch {
        // Syntax errors are reported by validateIcuMessages with the catalog key.
    }
}

function collectIcuArguments(elements: readonly MessageFormatElement[]): string[] {
    const names = new Set<string>();
    visit(elements);
    return [...names].sort();

    function visit(current: readonly MessageFormatElement[]): void {
        for (const element of current) {
            if (element.type === TYPE.argument
                || element.type === TYPE.number
                || element.type === TYPE.date
                || element.type === TYPE.time
                || element.type === TYPE.select
                || element.type === TYPE.plural) {
                names.add(element.value);
            }
            if (element.type === TYPE.tag) names.add(element.value);
            if (element.type === TYPE.select || element.type === TYPE.plural) {
                const options = (element as SelectElement | PluralElement).options;
                for (const option of Object.values(options)) visit(option.value);
            } else if (element.type === TYPE.tag) {
                visit(element.children);
            }
        }
    }
}

void main();
