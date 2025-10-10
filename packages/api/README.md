# API Package

Express REST API for Fakegaming.eu Bot external integrations and bot operations.

## Architecture

This API follows a layered architecture:

- **Routes** (`src/routes/`) - Express route handlers, validation, and HTTP concerns
- **Middleware** (`src/middleware/`) - Authentication, error handling, and request processing
- **Utils** (`src/utils/`) - Helper functions and shared utilities
- **Shared models/managers** (from `@zeffuro/fakegaming-common`) - Data layer and schemas

## Testing

### Test Infrastructure

The API package uses a comprehensive testing setup built on Vitest and the shared testing utilities from `@zeffuro/fakegaming-common/testing`.

#### Key Testing Utilities

- `setupApiTest(options)` — Sets up all necessary mocks and environment for API testing
- `setupApiRouteTest(options)` — Creates a complete test context with app factory
- `createTestApp(router, basePath)` — Creates minimal Express app for isolated route testing
- `signTestJwt(payload)` — Generates valid JWT tokens for authenticated requests

#### Example Test Pattern

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
    setupApiRouteTest,
    signTestJwt,
    createMockQuote
} from '@zeffuro/fakegaming-common/testing';

describe('Quotes API', () => {
    let app: Express;
    let token: string;

    beforeEach(async () => {
        const { createApp, configManager } = await setupApiRouteTest();

        // Configure mocks
        configManager.quoteManager.getAllPlain.mockResolvedValue([
            createMockQuote({ id: 1, quote: 'Test' })
        ]);

        app = await createApp();
        token = signTestJwt({ discordId: 'testuser' });
    });

    it('should return quotes', async () => {
        const res = await request(app)
            .get('/api/quotes')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# With coverage
pnpm test:coverage
```

## Validation

All API endpoints use shared Zod-based validation middleware from `@zeffuro/fakegaming-common`:

- `validateParams(schema)` — Validates path params; returns 400 with Zod issues on failure
- `validateQuery(schema)` — Validates query params; returns 400 with Zod issues on failure
- `validateBody(schema)` — Validates request body with a provided Zod schema; returns 400 on failure
- `validateBodyForModel(Model, mode)` — Validates body using a schema derived from a Sequelize model via the schema registry (`mode`: `create` | `update` | `full`)

Example using explicit Zod schema:

```typescript
import { z } from 'zod';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateBody, validateQuery, validateParams } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common';

const router = createBaseRouter();

const createQuoteSchema = z.object({
    guildId: z.string().min(1),
    authorId: z.string().min(1),
    quote: z.string().min(1)
});

/**
 * @openapi
 * /quotes:
 *   post:
 *     summary: Create a quote
 *     tags: [Quotes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuoteCreate'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Body validation failed
 *       401:
 *         description: Unauthorized
 */
router.post('/', validateBody(createQuoteSchema), async (req, res) => {
    const created = await getConfigManager().quoteManager.addPlain(req.body);
    res.status(201).json(created);
});

export { router };
```

For model-derived validation, prefer `validateBodyForModel(Model, 'create' | 'update')`.

## OpenAPI / Swagger

The API automatically generates OpenAPI specifications that are consumed by the dashboard.

### Generate OpenAPI Spec

```bash
pnpm run export:openapi
```

This creates `openapi.json` which is used by:
1. Dashboard — Generates TypeScript types via `openapi-typescript` and `scripts/generateApiAliases.ts`
2. Documentation — Available at `/api/docs` when running the server

### Swagger UI

When the server is running, visit:
```
http://localhost:3001/api/docs  (or http://localhost:<PORT>/api/docs)
```

## Routes

All routes are auto-discovered from `src/routes/` directory.

### Current Endpoints

- `/auth` - JWT authentication
- `/quotes` - Quote management
- `/users` - User data
- `/servers` - Server configuration
- `/birthdays` - Birthday tracking
- `/reminders` - Reminder system
- `/patchNotes` - Patch note distribution
- `/patchSubscriptions` - Patch subscription management
- `/disabledCommands` - Command configuration
- `/twitch` - Twitch integration
- `/youtube` - YouTube integration

### Adding New Routes

1. Create a new file in `src/routes/` (e.g., `myFeature.ts`)
2. Use `createBaseRouter()` for automatic error handling
3. Export router as named export: `export { router }`
4. Add OpenAPI documentation comments
5. Use shared validation middleware from `@zeffuro/fakegaming-common`

Example:

```typescript
import { z } from 'zod';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateBody } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common';

const router = createBaseRouter();

/**
 * @openapi
 * /myFeature:
 *   post:
 *     summary: Create new feature
 *     tags: [MyFeature]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 */
const createMyFeatureSchema = z.object({ name: z.string().min(1) });

router.post('/', validateBody(createMyFeatureSchema), async (req, res) => {
    const result = await getConfigManager().myFeatureManager.addPlain(req.body);
    res.status(201).json(result);
});

export { router };
```

## Error Handling

The API uses centralized error handling via `errorHandler` middleware:

- Validation errors (Zod) → 400 Bad Request with `error` and `details[]`
- NotFound → 404 Not Found
- Forbidden → 403 Forbidden
- JWT errors → 401 Unauthorized
- Unhandled errors → 500 Internal Server Error

All route handlers wrapped by `createBaseRouter()` automatically forward errors to the error handler.

## Environment Variables

Required:
- `JWT_SECRET` - Secret for signing JWT tokens
- `JWT_AUDIENCE` - JWT audience claim
- `DATABASE_PROVIDER` - Database type (sqlite/postgres)

Optional:
- `DASHBOARD_URL` - CORS origin for dashboard
- `PORT` - Server port (default: 4000)

## Development

```bash
# Development mode with hot reload
pnpm start:dev

# Production mode
pnpm start

# Build TypeScript
pnpm build

# Lint
pnpm lint
```

## Best Practices

1. Use shared validators — `validateBody`, `validateQuery`, `validateParams`, and `validateBodyForModel`
2. Named exports — Export routers as `export { router }`
3. Error handling — Use `createBaseRouter()` for automatic error propagation
4. Testing — Use shared test utilities from `@zeffuro/fakegaming-common/testing`
5. Documentation — Add OpenAPI comments to all endpoints
6. Keep routes thin — Delegate to managers/services for business logic
7. Type safety — Use strict TypeScript, no implicit `any`
