# API Package

Express REST API for Fakegaming.eu Bot external integrations and bot operations.

## Architecture

This API follows a layered architecture:

- **Routes** (`src/routes/`) - Express route handlers, validation, and HTTP concerns
- **Middleware** (`src/middleware/`) - Authentication, error handling, and request processing
- **Utils** (`src/utils/`) - Helper functions and shared utilities
- **DTOs** (from `@zeffuro/fakegaming-common/dto`) - Type-safe data transfer objects
- **Managers** (from `@zeffuro/fakegaming-common/managers`) - Data access layer

## Testing

### Test Infrastructure

The API package uses a comprehensive testing setup built on Vitest and the shared testing utilities from `@zeffuro/fakegaming-common/testing`.

#### Key Testing Utilities

**`setupApiTest(options)`** - Sets up all necessary mocks and environment for API testing
**`setupApiRouteTest(options)`** - Creates a complete test context with app factory
**`createTestApp(router, basePath)`** - Creates minimal Express app for isolated route testing
**`signTestJwt(payload)`** - Generates valid JWT tokens for authenticated requests

#### Example Test Pattern

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
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

## DTOs and Validation

All API endpoints should use DTOs from `@zeffuro/fakegaming-common/dto` for type safety:

```typescript
import type { CreateQuoteDTO } from '@zeffuro/fakegaming-common';
import { validateCreateQuote } from '@zeffuro/fakegaming-common';

router.post('/quotes', async (req, res) => {
    // Validate request body
    const quoteData = validateCreateQuote(req.body);
    
    // Use with manager
    const quote = await configManager.quoteManager.addPlain(quoteData);
    
    res.json(quote);
});
```

Available validators:
- `validateCreateQuote(data)` - Validates quote creation
- `validateCreatePatchNote(data)` - Validates patch note creation
- `validateCreateBirthday(data)` - Validates birthday creation
- And more...

## OpenAPI / Swagger

The API automatically generates OpenAPI specifications that are consumed by the dashboard.

### Generate OpenAPI Spec

```bash
pnpm run export:openapi
```

This creates `openapi.json` which is used by:
1. **Dashboard** - Generates TypeScript types via `generateApiAliases.ts`
2. **Documentation** - Available at `/api/docs` when running the server

### Swagger UI

When the server is running, visit:
```
http://localhost:4000/api/docs
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
5. Use DTOs and validation from common package

Example:

```typescript
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateCreateMyFeature } from '@zeffuro/fakegaming-common';

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
 *             $ref: '#/components/schemas/MyFeatureConfig'
 */
router.post('/', async (req, res) => {
    const data = validateCreateMyFeature(req.body);
    const result = await getConfigManager().myFeatureManager.addPlain(data);
    res.json(result);
});

export { router };
```

## Error Handling

The API uses centralized error handling via `errorHandler` middleware:

- **ValidationError** → 400 Bad Request
- **NotFoundError** → 404 Not Found
- **ForbiddenError** → 403 Forbidden
- **JWT Errors** → 401 Unauthorized
- **Unhandled Errors** → 500 Internal Server Error

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

1. **Use DTOs** - Always validate input with DTOs from common package
2. **Named Exports** - Export routers as `export { router }`
3. **Error Handling** - Use `createBaseRouter()` for automatic error propagation
4. **Testing** - Use shared test utilities from `@zeffuro/fakegaming-common/testing`
5. **Documentation** - Add OpenAPI comments to all endpoints
6. **No Business Logic** - Keep routes thin, delegate to services or managers
7. **Type Safety** - Use strict TypeScript, no implicit `any`
