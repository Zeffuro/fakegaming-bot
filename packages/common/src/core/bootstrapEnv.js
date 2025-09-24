import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
/**
 * Initializes environment variables using dotenv and returns file and directory paths based on the module URL.
 * @param metaUrl The module's meta URL (typically import.meta.url).
 * @returns The resolved filename and directory name.
 */
export function bootstrapEnv(metaUrl) {
    const __filename = fileURLToPath(metaUrl);
    const __dirname = path.dirname(__filename);
    const envFile = process.env.NODE_ENV === 'development' ? '.env.development' : '.env';
    const envPath = path.resolve(__dirname, '../../../', envFile);
    dotenvExpand.expand(dotenv.config({ path: envPath }));
    return { __filename, __dirname };
}
