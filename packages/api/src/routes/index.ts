import { readdirSync, statSync } from 'fs';
import path from 'path';
import { Router } from 'express';
import { fileURLToPath } from 'url';

const router = Router();

// Determine current directory and target extension (.ts in dev via tsx, .js in production/dist)
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const isProd =
    process.env.NODE_ENV === 'production' ||
    currentDir.endsWith('/dist/routes') ||
    currentDir.includes('\\dist\\routes');
const routesDir = currentDir; // this file lives in src/routes (dev) or dist/routes (prod)
const targetExt = isProd ? '.js' : '.ts';

/**
 * Recursively read all route files with the target extension (excluding index and tests)
 */
function getRouteFiles(dir: string): string[] {
    const entries = readdirSync(dir);
    let files: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            files = files.concat(getRouteFiles(fullPath));
        } else if (
            entry.endsWith(targetExt) &&
            entry !== `index${targetExt}` &&
            !entry.endsWith(`.test${targetExt}`)
        ) {
            files.push(fullPath);
        }
    }

    return files;
}

const routeFiles = getRouteFiles(routesDir);

function isExpressRouter(obj: unknown): obj is Router {
    return !!obj && typeof obj === 'function' && typeof (obj as unknown as { use?: unknown }).use === 'function';
}

for (const file of routeFiles) {
    // Generate a route path relative to routesDir
    let routePath =
        file
            .replace(routesDir, '')
            .replace(new RegExp(`\\${targetExt}$`), '')
            .replace(/\\/g, '/')
            .replace(/\/index$/, '') || '/';

    // Dynamic import using a relative specifier so Vitest/Vite can transform and mock dependencies
    const relativeSpecifier = './' + path.posix.relative(routesDir.replace(/\\/g, '/'), file.replace(/\\/g, '/'));
    const routeModule = await import(relativeSpecifier);
    const candidate = (routeModule.router ?? routeModule.default) as unknown;

    if (!isExpressRouter(candidate)) {
        // Skip files that do not export an Express Router (e.g., schema or helper files)
        continue;
    }

    router.use(routePath, candidate);
}

export { router };
