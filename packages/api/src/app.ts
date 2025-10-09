import express from 'express';
import { router as apiRouter } from './routes/index.js';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import cors from 'cors';
import { PROJECT_ROOT } from '@zeffuro/fakegaming-common/core';
import { jwtAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const app = express();

// JSON parsing
app.use(express.json());

// CORS
const DASHBOARD_URL = process.env.DASHBOARD_URL || process.env.PUBLIC_URL || 'http://localhost:3000';
app.use(cors({
    origin: DASHBOARD_URL,
    credentials: true,
}));

// Apply JWT auth to all /api routes except /api/auth/login
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth/login')) return next();
    return jwtAuth(req, res, next);
});

// Mount the API router
app.use('/api', apiRouter);

// Catch 404
app.use('/api', (_req, _res, next) => {
    const err = new Error('Not Found');
    (err as any).status = 404;
    next(err);
});

// Global error handler
app.use(errorHandler);

// Swagger setup (runtime-aware)
const isProd = process.env.NODE_ENV === 'production';
let swaggerSpec: any;
if (isProd) {
    // In production, serve the pre-generated openapi.json produced at build time
    const here = path.dirname(fileURLToPath(import.meta.url)); // .../packages/api/dist
    const openApiPath = path.resolve(here, '../openapi.json');
    try {
        const file = readFileSync(openApiPath, 'utf-8');
        swaggerSpec = JSON.parse(file);
    } catch (e) {
        console.warn(`[swagger] Failed to load openapi.json at ${openApiPath}:`, e);
        swaggerSpec = { openapi: '3.0.0', info: { title: 'Fakegaming API', version: '1.0.0' } };
    }
} else {
    // In development, generate from source annotations
    const swaggerOptions = {
        definition: {
            openapi: '3.0.0',
            info: {
                title: 'Fakegaming Bot API',
                version: '1.0.0',
            },
            servers: [
                {
                    url: '/api',
                    description: 'API base path',
                },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        description: 'Login via /auth/login and paste the token here using the "Authorize" button.',
                    },
                },
            },
            security: [{ bearerAuth: [] }],
        },
        apis: [path.join(PROJECT_ROOT, 'packages/api/src/routes/**/*.ts')], // only in dev
    } as const;
    swaggerSpec = swaggerJsdoc(swaggerOptions);
}

// Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

export { swaggerSpec, swaggerUi };
export default app;
