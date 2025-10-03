import express from 'express';
import apiRouter from './routes/index.js';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import {PROJECT_ROOT} from '@zeffuro/fakegaming-common/core';
import swaggerUi from 'swagger-ui-express';
import {jwtAuth} from './middleware/auth.js';
import {errorHandler} from './middleware/errorHandler.js';
import cors from 'cors';

const app = express();

app.use(express.json());
const DASHBOARD_URL = process.env.DASHBOARD_URL || process.env.PUBLIC_URL || 'http://localhost:3000';
app.use(cors({
    origin: DASHBOARD_URL,
    credentials: true
}));
// Apply JWT auth to all /api routes except /api/auth/login
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth/login')) return next();
    return jwtAuth(req, res, next);
});
app.use('/api', apiRouter);
app.use('/api', (req, res, next) => {
    const err = new Error('Not Found');
    (err as any).status = 404;
    next(err);
});
app.use(errorHandler);

// Add OpenAPI security scheme
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
                description: 'API base path'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Login via /auth/login and paste the token here using the "Authorize" button.'
                }
            }
        },
        security: [{bearerAuth: []}],
    },
    apis: [path.join(PROJECT_ROOT, 'packages/api/src/routes/*.ts')],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export {swaggerSpec, swaggerUi};
export default app;
