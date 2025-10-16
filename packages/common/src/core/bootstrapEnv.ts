import {fileURLToPath} from 'url';
import path from 'path';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { getLogger } from '../utils/logger.js';

/**
 * Initializes environment variables using dotenv and returns file and directory paths based on the module URL.
 * @param metaUrl The module's meta URL (typically import.meta.url).
 * @returns The resolved filename and directory name.
 */
export function bootstrapEnv(metaUrl?: string) {
    let __filename: string = "";
    let __dirname: string = "";
    if (metaUrl) {
        __filename = fileURLToPath(metaUrl);
        __dirname = path.dirname(__filename);
    } else if (typeof __filename !== "undefined" && typeof __dirname !== "undefined") {
        // Fallback for CommonJS globals
        __filename = (globalThis as any).__filename || "";
        __dirname = (globalThis as any).__dirname || "";
    }

    let envFile = '.env';
    if (process.env.NODE_ENV === 'development') {
        envFile = '.env.development';
    } else if (process.env.NODE_ENV === 'production') {
        envFile = '.env.production';
    }

    // Always resolve .env files from the package root (one level up from src)
    let envPath = path.resolve(__dirname, '..', envFile);
    // Try to load the environment-specific file, fallback to .env if missing
    let result = dotenv.config({path: envPath});
    if (result.error || !result.parsed) {
        // Fallback to .env if the specific file is missing
        envPath = path.resolve(__dirname, '..', '.env');
        result = dotenv.config({path: envPath});
    }
    dotenvExpand.expand(result);

    // Only create the logger AFTER env is loaded so LOG_PRETTY/LOG_LEVEL are respected
    const log = getLogger({ name: 'common:env' });
    const loadedKeys = result.parsed ? Object.keys(result.parsed) : [];
    log.info({ envPath, loadedKeys }, '[bootstrapEnv] Loaded environment');
    return {__filename, __dirname};
}