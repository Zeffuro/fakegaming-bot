import {fileURLToPath} from 'url';
import path from 'path';
import dotenv from 'dotenv';

export function bootstrapEnv(metaUrl: string) {
    const __filename = fileURLToPath(metaUrl);
    const __dirname = path.dirname(__filename);
    dotenv.config();
    return {__filename, __dirname};
}