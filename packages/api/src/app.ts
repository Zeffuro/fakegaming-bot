import express from 'express';
import apiRouter from './routes/index.js';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import {PROJECT_ROOT, bootstrapEnv} from '@zeffuro/fakegaming-common';
import swaggerUi from 'swagger-ui-express';

bootstrapEnv(import.meta.url);

const app = express();

app.use(express.json());
app.use('/api', apiRouter);

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
        ]
    },
    apis: [path.join(PROJECT_ROOT, 'packages/api/src/routes/*.ts')],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export {swaggerSpec, swaggerUi};
export default app;
