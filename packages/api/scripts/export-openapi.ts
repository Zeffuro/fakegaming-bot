import fs from 'fs';
import path from 'path';
import { bootstrapEnv } from '@zeffuro/fakegaming-common/core';
import { getSequelize } from '@zeffuro/fakegaming-common';
import { injectOpenApiSchemas } from '../src/utils/openapi-inject-schemas.js';

// Ensure we do not initialize DB while generating OpenAPI
process.env.API_BUILD_MODE = 'openapi';
process.env.SKIP_DB_INIT = '1';
// Force dev behavior so swagger-jsdoc scans route annotations
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
// Force SQLite provider so models can be initialized in-memory
process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';

const { __dirname } = bootstrapEnv(import.meta.url);

// Initialize Sequelize to register models (no authenticate/sync needed)
getSequelize(true);

// Dynamically import app after env flags are set to avoid early DB init
const { swaggerSpec } = await import('../src/app.js');

// Inject schemas before exporting
injectOpenApiSchemas(swaggerSpec);

// Write the OpenAPI spec to disk
const outputPath = path.resolve(__dirname, '../openapi.json');
fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
console.log(`Exported OpenAPI spec to ${outputPath}`);
