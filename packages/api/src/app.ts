import express from 'express';
import { router as apiRouter } from './routes/index.js';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import cors from 'cors';
import { PROJECT_ROOT, getSequelize, getLogger } from '@zeffuro/fakegaming-common';
import { jwtAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { rateLimit } from './middleware/rateLimit.js';
import { enforceCsrfOnce } from './middleware/csrf.js';

const app = express();

// JSON parsing
app.use(express.json());

// Liveness probe (process OK)
app.get('/healthz', (_req, res) => {
    res.status(200).json({ ok: true });
});

// Readiness probe (DB connectivity OK)
app.get('/ready', async (_req, res) => {
    try {
        const useTest = process.env.NODE_ENV === 'test';
        const sequelize = getSequelize(useTest);
        // authenticate() is cross-dialect and does not modify state
        await sequelize.authenticate();
        res.status(200).json({ ok: true });
    } catch {
        res.status(503).json({ ok: false, error: { code: 'DB_UNAVAILABLE' } });
    }
});

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

// Enforce CSRF on mutating routes (skip login); enforceCsrfOnce will short-circuit after first check
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth/login')) return next();
    return enforceCsrfOnce(req, res, next);
});

// Apply rate limiting after auth and CSRF (skip login)
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth/login')) return next();
    return rateLimit(req, res, next);
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
const log = getLogger({ name: 'api:swagger' });
if (isProd) {
    // In production, serve the pre-generated openapi.json produced at build time
    const here = path.dirname(fileURLToPath(import.meta.url)); // .../packages/api/dist
    const openApiPath = path.resolve(here, '../openapi.json');
    try {
        const file = readFileSync(openApiPath, 'utf-8');
        swaggerSpec = JSON.parse(file);
    } catch (e) {
        log.warn({ err: e, openApiPath }, '[swagger] Failed to load openapi.json');
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
