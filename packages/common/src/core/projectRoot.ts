import path from "path";
import {fileURLToPath} from 'url';

const filename = fileURLToPath(import.meta.url);
const projectDir = path.dirname(filename);

export const PROJECT_ROOT = path.resolve(projectDir, '../../../../');