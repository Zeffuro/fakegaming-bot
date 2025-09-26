import {bootstrapEnv, getConfigManager} from '@zeffuro/fakegaming-common';
import app, {swaggerSpec, swaggerUi} from './app.js';
import {sequelizeModelToOpenAPISchema} from './utils/sequelize-to-openapi.js';
import {
    BirthdayConfig,
    PatchNoteConfig,
    PatchSubscriptionConfig,
    QuoteConfig,
    ReminderConfig,
    ServerConfig,
    TwitchStreamConfig,
    UserConfig,
    YoutubeVideoConfig
} from '@zeffuro/fakegaming-common';

bootstrapEnv(import.meta.url);

const port = process.env.PORT || 3001;

// Remove all app setup code, keep only the server start logic
async function startServer() {
    try {
        await getConfigManager().init();
        // Inject OpenAPI schemas after DB init
        (swaggerSpec as any).components = (swaggerSpec as any).components || {};
        (swaggerSpec as any).components.schemas = {
            BirthdayConfig: sequelizeModelToOpenAPISchema(BirthdayConfig),
            PatchNoteConfig: sequelizeModelToOpenAPISchema(PatchNoteConfig),
            PatchSubscriptionConfig: sequelizeModelToOpenAPISchema(PatchSubscriptionConfig),
            QuoteConfig: sequelizeModelToOpenAPISchema(QuoteConfig),
            ReminderConfig: sequelizeModelToOpenAPISchema(ReminderConfig),
            ServerConfig: sequelizeModelToOpenAPISchema(ServerConfig),
            TwitchStreamConfig: sequelizeModelToOpenAPISchema(TwitchStreamConfig),
            UserConfig: sequelizeModelToOpenAPISchema(UserConfig),
            YoutubeVideoConfig: sequelizeModelToOpenAPISchema(YoutubeVideoConfig),
        };
        console.log('OpenAPI schemas injected:', Object.keys((swaggerSpec as any).components.schemas));
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
        app.listen(port, () => {
            console.log(`API server running on port ${port}\nYou can access the API documentation at http://localhost:${port}/api-docs`);
        });
    } catch (err) {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    }
}

startServer();
