import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_README_PATH = path.join(PROJECT_ROOT, 'README.md');
const BOT_README_PATH = path.join(PROJECT_ROOT, 'packages/bot/README.md');
const BOT_PACKAGE_PATH = path.join(PROJECT_ROOT, 'packages/bot/package.json');
const BOT_INDEX_PATH = path.join(PROJECT_ROOT, 'packages/bot/src/index.ts');

interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

const errors: string[] = [];

function readText(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readText(filePath)) as T;
}

function addError(message: string): void {
    errors.push(message);
}

function getMarkdownSection(markdown: string, heading: string): string {
    const lines = markdown.split(/\r?\n/);
    const startIndex = lines.findIndex(line => line.trim() === heading);
    if (startIndex === -1) return '';

    const sectionLines: string[] = [];
    for (const line of lines.slice(startIndex + 1)) {
        if (/^#{1,6}\s/.test(line)) break;
        sectionLines.push(line);
    }

    return sectionLines.join('\n');
}

function getDocumentedDependencyNames(section: string): string[] {
    return [...section.matchAll(/^- `([^`]+)`/gm)].map(match => match[1]?.trim()).filter((value): value is string => Boolean(value));
}

function getUsedGatewayIntentNames(source: string): string[] {
    return [...new Set([...source.matchAll(/GatewayIntentBits\.([A-Za-z0-9_]+)/g)].map(match => match[1]))].sort();
}

function checkRootReadme(rootReadme: string): void {
    if (rootReadme.includes('EventSub webhooks')) {
        addError('README.md still describes Twitch notifications as EventSub webhooks; current implementation uses Helix polling.');
    }

    if (!rootReadme.includes('Twitch stream notifications (Helix polling)')) {
        addError('README.md should document Twitch stream notifications as Helix polling.');
    }
}

function checkBotDependencies(botReadme: string, botPackage: PackageJson): void {
    const externalSection = getMarkdownSection(botReadme, '### External APIs');
    const documentedDependencies = getDocumentedDependencyNames(externalSection);
    const runtimeDependencies = new Set(Object.keys(botPackage.dependencies ?? {}));

    for (const dependency of documentedDependencies) {
        if (!runtimeDependencies.has(dependency)) {
            addError(`packages/bot/README.md documents external API dependency '${dependency}', but it is not in packages/bot/package.json dependencies.`);
        }
    }

    for (const dependency of ['axios', 'twisted']) {
        if (runtimeDependencies.has(dependency) && !documentedDependencies.includes(dependency)) {
            addError(`packages/bot/README.md should document external API dependency '${dependency}'.`);
        }
    }
}

function checkBotIntents(botReadme: string, botIndex: string): void {
    const usedIntents = getUsedGatewayIntentNames(botIndex);
    const staleIntentLabels = [
        ['Presence Intent', 'GuildPresences'],
        ['Server Members Intent', 'GuildMembers'],
        ['Message Content Intent', 'MessageContent'],
    ] as const;

    for (const intent of usedIntents) {
        if (!botReadme.includes(`GatewayIntentBits.${intent}`)) {
            addError(`packages/bot/README.md should mention required Discord intent GatewayIntentBits.${intent}.`);
        }
    }

    for (const [label, intent] of staleIntentLabels) {
        if (!usedIntents.includes(intent) && botReadme.includes(label)) {
            addError(`packages/bot/README.md still mentions '${label}', but packages/bot/src/index.ts does not request GatewayIntentBits.${intent}.`);
        }
    }
}

function main(): void {
    const rootReadme = readText(ROOT_README_PATH);
    const botReadme = readText(BOT_README_PATH);
    const botPackage = readJson<PackageJson>(BOT_PACKAGE_PATH);
    const botIndex = readText(BOT_INDEX_PATH);

    checkRootReadme(rootReadme);
    checkBotDependencies(botReadme, botPackage);
    checkBotIntents(botReadme, botIndex);

    if (errors.length > 0) {
        console.error('Documentation consistency check failed:');
        for (const error of errors) {
            console.error(` - ${error}`);
        }
        process.exit(1);
    }

    console.log('Documentation consistency checks passed.');
}

main();
