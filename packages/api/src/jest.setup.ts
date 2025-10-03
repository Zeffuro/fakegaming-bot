import './testUtils/mockCache.js'; // Import cache mocking first
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import 'ts-node/register';

import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.TS_NODE_PROJECT = path.resolve(__dirname, '../tsconfig.json');
process.env.NODE_ENV = 'test';

const configManager = getConfigManager();

beforeAll(async () => {
    process.env.DATABASE_PROVIDER = 'sqlite';
    await configManager.init(true); // runs migrations + sync
});


export {configManager};