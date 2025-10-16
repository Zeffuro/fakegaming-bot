# API Testing Guide

This guide covers the comprehensive testing infrastructure for API packages in the fakegaming-bot monorepo.

## Overview

The API testing infrastructure provides:

- **Automatic mocking** of ConfigManager and all managers
- **JWT token generation** for authenticated requests
- **Express app factories** for isolated route testing
- **Shared Zod validation middleware** for consistent runtime validation
- **Supertest integration** for HTTP request testing

## Quick Start

### Basic API Route Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
    setupApiRouteTest,
    signTestJwt,
    createMockQuote,
    expectOk
} from '@zeffuro/fakegaming-common/testing';
import type { Express } from 'express';

describe('Quotes API', () => {
    let app: Express;
    let token: string;

    beforeEach(async () => {
        const { createApp, configManager } = await setupApiRouteTest();

        // Configure mock data
        configManager.quoteManager.getAllPlain.mockResolvedValue([
            createMockQuote({ id: 1, quote: 'Test quote' })
        ]);

        app = await createApp();
        token = signTestJwt({ discordId: 'testuser' });
    });

    it('should return quotes', async () => {
        const res = await request(app)
            .get('/api/quotes')
            .set('Authorization', `Bearer ${token}`);

        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
    });
});
```

## Core Testing Utilities

### `setupApiTest(options)`

Sets up the complete test environment including mocks, environment variables, and ConfigManager.

```typescript
import { setupApiTest } from '@zeffuro/fakegaming-common/testing';

const configManager = await setupApiTest({
    env: {
        JWT_SECRET: 'custom-secret'
    },
    managerOverrides: {
        quoteManager: {
            getAllPlain: vi.fn().mockResolvedValue([])
        }
    }
});
```

**Options:**
- `env` - Custom environment variables
- `configManager` - Custom ConfigManager instance
- `setupCache` - Setup cache mocks (default: true)
- `setupManagers` - Setup manager mocks (default: true)
- `setupModels` - Setup model mocks (default: true)
- `managerOverrides` - Override specific manager methods

### `setupApiRouteTest(options)`

Creates a complete test context for testing API routes with supertest.

```typescript
import { setupApiRouteTest } from '@zeffuro/fakegaming-common/testing';

const { createApp, configManager } = await setupApiRouteTest({
    appFactory: async (_cm) => {
        // Custom app factory if needed
        const express = await import('express');
        const app = express.default();
        // ... configure app
        return app;
    },
    // Auto-seeding: by default, seeds 'testuser' as admin of 'test-guild'
    // Customize or disable as needed:
    // autoSeedTestUserGuild: true,
    // seed: { userId: 'alice', guildId: 'guild-123', permissions: 0x8, owner: false, ttlMs: 5000 },
});

const app = await createApp();
```

Auto-seeding details:
- Enabled by default via `autoSeedTestUserGuild: true`.
- Defaults: `userId: 'testuser'`, `guildId: 'test-guild'`, `permissions: 0x8 (Administrator)`, `owner: false`.
- `permissions` may be number or string; coerced to string internally.
- Disable with `autoSeedTestUserGuild: false`.

**Returns:**
- `createApp()` - Function to create Express app instance
- `configManager` - Mocked ConfigManager for test configuration

### `withApiTest(options)`

Lifecycle helper for test suites with automatic setup/teardown.

```typescript
import { withApiTest } from '@zeffuro/fakegaming-common/testing';

describe('My API Tests', () => {
    const { getConfigManager } = withApiTest();

    it('should work', async () => {
        const cm = getConfigManager();
        cm.quoteManager.getAllPlain.mockResolvedValue([]);
        // ... test logic
    });
});
```

## Authentication Testing

### `signTestJwt(payload, secret?, audience?)`

Generates a valid JWT token for authenticated requests.

```typescript
import { signTestJwt } from '@zeffuro/fakegaming-common/testing';

const token = signTestJwt({ 
    discordId: 'user123',
    customClaim: 'value'
});

const res = await request(app)
    .get('/api/protected')
    .set('Authorization', `Bearer ${token}`);
```

### Testing Unauthorized Access

```typescript
import { expectUnauthorized } from '@zeffuro/fakegaming-common/testing';

it('should return 401 without token', async () => {
    const res = await request(app).get('/api/protected');
    expectUnauthorized(res);
});

it('should return 401 with invalid token', async () => {
    const res = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid-token');
    expectUnauthorized(res);
});
```

## Mock Data Factories

### Creating Mock Models

```typescript
import {
    createMockQuote,
    createMockPatchNote,
    createMockBirthday,
    createMockReminder
} from '@zeffuro/fakegaming-common/testing';

const quote = createMockQuote({
    id: 1,
    guildId: 'guild123',
    quote: 'Custom quote text'
});

const note = createMockPatchNote({
    game: 'lol',
    version: '14.1',
    title: 'Patch 14.1'
});
```

### Configuring Manager Mocks

```typescript
beforeEach(async () => {
    const { configManager } = await setupApiRouteTest();

    // Mock getAllPlain to return test data
    configManager.quoteManager.getAllPlain.mockResolvedValue([
        createMockQuote({ id: 1 }),
        createMockQuote({ id: 2 })
    ]);

    // Mock specific methods with logic
    configManager.quoteManager.getQuotesByGuild.mockImplementation(
        async (guildId: string) => {
            const allQuotes = await configManager.quoteManager.getAllPlain();
            return allQuotes.filter(q => q.guildId === guildId);
        }
    );

    // Mock methods that modify data
    configManager.quoteManager.addPlain.mockImplementation(
        async (data) => ({ id: 3, ...data })
    );
});
```

## Express Mocks

### Mock Request/Response/Next

```typescript
import {
    createMockRequest,
    createMockResponse,
    createMockNext,
    createMockAuthRequest
} from '@zeffuro/fakegaming-common/testing';

// Basic request
const req = createMockRequest({
    body: { quote: 'test' },
    params: { id: '123' }
});

// Authenticated request
const authReq = createMockAuthRequest('user123', {
    body: { quote: 'test' }
});

// Response with spies
const { res, json, status } = createMockResponse();

// Next function
const next = createMockNext();

// Test middleware
await myMiddleware(req, res, next);

expect(status).toHaveBeenCalledWith(200);
expect(json).toHaveBeenCalledWith({ success: true });
```

## Validation (Zod + middleware)

### Using shared validators in routes

```typescript
import { z } from 'zod';
import { validateBody } from '@zeffuro/fakegaming-common';

const createQuoteSchema = z.object({
    guildId: z.string().min(1),
    authorId: z.string().min(1),
    quote: z.string().min(1)
});

router.post('/quotes', validateBody(createQuoteSchema), async (req, res) => {
    const quote = await configManager.quoteManager.addPlain(req.body);
    res.status(201).json(quote);
});
```

### Testing validation

Standardized error shape on validation failure:

```json
{
  "error": "Body validation failed",
  "details": [
    { "path": "field", "message": "..." }
  ]
}
```

Example tests:

```typescript
it('should return 400 on invalid body', async () => {
    const res = await request(app)
        .post('/api/quotes')
        .set('Authorization', `Bearer ${token}`)
        .send({ guildId: '', authorId: 'u', quote: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Body validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
});

it('should return 400 on invalid query', async () => {
    const res = await request(app)
        .get('/api/quotes/search')
        .set('Authorization', `Bearer ${token}`)
        .query({ q: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Query validation failed');
});

it('should return 400 on invalid params', async () => {
    const res = await request(app)
        .get('/api/quotes/not-an-int')
        .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Params validation failed');
});
```

## Isolated Route Testing

### Testing Individual Routes

```typescript
import { createTestApp } from '@zeffuro/fakegaming-common/testing';
import { router as quotesRouter } from '../routes/quotes.js';

describe('Quotes Router (Isolated)', () => {
    let app: Express;

    beforeEach(async () => {
        const { configManager } = await setupApiTest();
        
        // Configure mocks
        configManager.quoteManager.getAllPlain.mockResolvedValue([]);

        // Create minimal app with just this router
        app = await createTestApp(quotesRouter, '/api/quotes');
    });

    it('should work', async () => {
        const res = await request(app).get('/api/quotes');
        expect(res.status).toBe(200);
    });
});
```

### Testing with Authentication

```typescript
import { createAuthenticatedTestApp } from '@zeffuro/fakegaming-common/testing';

const app = await createAuthenticatedTestApp(router, {
    basePath: '/api',
    publicPaths: ['/auth/login'],
    protectedPaths: ['/quotes', '/users']
});
```

## Testing Patterns

### Pattern 1: Full Integration Test

Tests the complete API with all routes and middleware.

```typescript
import app from '../app.js';

describe('Full API Integration', () => {
    beforeEach(async () => {
        await setupApiTest();
    });

    it('should handle complete workflow', async () => {
        const token = signTestJwt({ discordId: 'user123' });

        // Create resource
        const createRes = await request(app)
            .post('/api/quotes')
            .set('Authorization', `Bearer ${token}`)
            .send({ guildId: 'guild1', quote: 'Test', authorId: 'user123' });

        expect(createRes.status).toBe(201);

        // Get resource
        const getRes = await request(app)
            .get('/api/quotes')
            .set('Authorization', `Bearer ${token}`);

        expect(getRes.status).toBe(200);
    });
});
```

### Pattern 2: Isolated Route Test

Tests a single route in isolation.

```typescript
import { createTestApp } from '@zeffuro/fakegaming-common/testing';
import { router } from '../routes/quotes.js';

describe('Quotes Route (Isolated)', () => {
    let app: Express;
    let configManager: ConfigManager;

    beforeEach(async () => {
        configManager = await setupApiTest();
        app = await createTestApp(router);
    });

    it('should list quotes', async () => {
        configManager.quoteManager.getAllPlain.mockResolvedValue([]);
        const res = await request(app).get('/api');
        expect(res.status).toBe(200);
    });
});
```

### Pattern 3: Middleware Test

Tests middleware functions directly.

```typescript
import { createMockRequest, createMockResponse, createMockNext } from '@zeffuro/fakegaming-common/testing';
import { jwtAuth } from '../middleware/auth.js';

describe('JWT Auth Middleware', () => {
    it('should allow valid token', async () => {
        const token = signTestJwt({ discordId: 'user123' });
        const req = createMockRequest({
            headers: { authorization: `Bearer ${token}` }
        });
        const { res } = createMockResponse();
        const next = createMockNext();

        await jwtAuth(req, res, next);

        expect(next).toHaveBeenCalled();
    });
});
```

## Best Practices

### 1. Prefer shared validators over ad-hoc parsing

```typescript
// ✅ Good
router.post('/', validateBody(schema), handler);

// ❌ Avoid
const parsed = schema.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ error: '...' });
```

### 2. Mock at the Manager Level

```typescript
// ✅ Good - Mock manager methods
configManager.quoteManager.getAllPlain.mockResolvedValue([...]);

// ❌ Bad - Don't mock database directly
vi.mock('sequelize');
```

### 3. Use Factory Functions for Test Data

```typescript
// ✅ Good
const quote = createMockQuote({ id: 1, quote: 'Test' });

// ❌ Bad
const quote = { id: 1, guildId: 'g', quote: 'Test', authorId: 'u', addedAt: 123 } as any;
```

### 4. Test Both Success and Error Cases

```typescript
describe('POST /quotes', () => {
    it('should create quote', async () => { /* ... */ });
    it('should return 400 on invalid data', async () => { /* ... */ });
    it('should return 401 without auth', async () => { /* ... */ });
    it('should return 403 without guild access', async () => { /* ... */ });
});
```

### 5. Keep Tests DRY

```typescript
// ✅ Good - Reuse setup
const setupQuoteTest = async () => {
    const { createApp, configManager } = await setupApiRouteTest();
    configManager.quoteManager.getAllPlain.mockResolvedValue([]);
    return { app: await createApp(), configManager };
};

beforeEach(async () => {
    const context = await setupQuoteTest();
    app = context.app as any;
});
```

## Troubleshooting

### Test Fails with "Cannot find module"

Make sure you're using the correct import path and the module is built:

```bash
pnpm -r build
```

### Mocks Not Working

Ensure you're calling `setupApiTest()` or `setupApiRouteTest()` in `beforeEach`:

```typescript
beforeEach(async () => {
    await setupApiTest();
});
```

### JWT Validation Fails

Check that environment variables are set correctly:

```typescript
process.env.JWT_SECRET = 'testsecret';
process.env.JWT_AUDIENCE = 'fakegaming-dashboard';
```

### Manager Method Not Mocked

Make sure the method is called after setup and that you're using the correct manager:

```typescript
beforeEach(async () => {
    const { configManager } = await setupApiRouteTest();
    // Mock AFTER getting configManager
    configManager.quoteManager.getAllPlain.mockResolvedValue([]);
});
```

## Migration from Old Pattern

### Old Pattern (Manual Setup)

```typescript
// ❌ Old
import express from 'express';
import { router } from '../routes/quotes.js';

const app = express();
app.use(express.json());
app.use('/api', router);

vi.mock('@zeffuro/fakegaming-common/managers');
```

### New Pattern (Automated)

```typescript
// ✅ New
import { setupApiRouteTest, signTestJwt } from '@zeffuro/fakegaming-common/testing';

const { createApp, configManager } = await setupApiRouteTest();
const app = await createApp();
const token = signTestJwt({ discordId: 'user123' });
```

## Examples

See `packages/api/src/__tests__/examples/` for complete working examples.
