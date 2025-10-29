# @zeffuro/fakegaming-common

Shared package for the fakegaming-bot monorepo containing database models, managers, utilities, types, and testing helpers.

## Overview

This package provides the foundational infrastructure used by all other packages (bot, API, dashboard). It ensures consistency and DRY principles across the monorepo.

## What's Included

### Database Models

Sequelize TypeScript models for all database tables:

```typescript
import {
    UserConfig,
    LeagueConfig,
    QuoteConfig,
    ReminderConfig,
    BirthdayConfig,
    TwitchStreamConfig,
    YoutubeVideoConfig,
    PatchNoteConfig,
    ServerConfig,
    DisabledCommandConfig,
    DisabledModuleConfig,
    CacheConfig
} from '@zeffuro/fakegaming-common/models';
```

### Managers

Business logic layer for database operations:

```typescript
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';

const configManager = getConfigManager();

// Use managers
await configManager.quoteManager.add({ quote: '...', ... });
await configManager.birthdayManager.getByUserId('123');
await configManager.userManager.findOrCreate({ discordId: '123' });
```

### Utilities

Common utilities for logging, validation, environment, etc.:

```typescript
import { getLogger } from '@zeffuro/fakegaming-common/utils/logger';
import { getSequelize } from '@zeffuro/fakegaming-common/utils/sequelize';
import { runMigrations } from '@zeffuro/fakegaming-common/utils/migrations';
```

### Testing Helpers

Comprehensive testing utilities for Vitest:

```typescript
import {
    setupCommandTest,
    setupServiceTest,
    createMockClient,
    createMockCommandInteraction,
    expectEphemeralReply,
    expectReplyText
} from '@zeffuro/fakegaming-common/testing';
```

See [TESTING_API.md](./TESTING_API.md) and [src/testing/README.md](./src/testing/README.md) for complete documentation.

### Types

Shared TypeScript types and interfaces:

```typescript
import type {
    MinimalGuildData,
    MinimalUserProfile,
    BirthdayData
} from '@zeffuro/fakegaming-common/types';
```

### Validation

Zod schemas for API request validation:

```typescript
import { validateBody, validateParams, validateQuery } from '@zeffuro/fakegaming-common/validation';
import { quoteSchema, birthdaySchema } from '@zeffuro/fakegaming-common/validation/schemas';
```

## Installation

This package is automatically installed as a workspace dependency.

From repository root:

```bash
pnpm install
```

## Building

Common must be built before other packages:

```bash
# From repository root
pnpm --filter @zeffuro/fakegaming-common run build

# From this package
pnpm build
```

Build output goes to `dist/`.

## Directory Structure

```
packages/common/
├── src/
│   ├── models/           # Sequelize models
│   ├── managers/         # Business logic layer
│   ├── utils/            # Shared utilities
│   ├── types/            # TypeScript types
│   ├── validation/       # Zod schemas and validators
│   ├── testing/          # Test helpers and mocks
│   ├── manifest/         # Auto-generated bot command manifest
│   ├── discord/          # Discord utilities (auth, API)
│   ├── security/         # Security utilities (CSRF, JWT)
│   └── index.ts          # Main exports
├── dist/                 # Compiled output
├── types/                # Generated API types
├── TESTING_API.md        # Testing API documentation
├── USAGE.md              # Usage examples
└── package.json
```

## Usage

### Database Models

Models use Sequelize TypeScript decorators:

```typescript
import { UserConfig } from '@zeffuro/fakegaming-common/models';

// Create
const user = await UserConfig.create({
    discordId: '123456789',
    timezone: 'America/New_York'
});

// Find
const user = await UserConfig.findByPk('123456789');

// Update
await user.update({ timezone: 'Europe/London' });

// Delete
await user.destroy();
```

### Managers

Managers provide a higher-level API:

```typescript
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';

const manager = getConfigManager();

// Quotes
const quote = await manager.quoteManager.add({
    guildId: '123',
    quote: 'Hello world',
    authorId: '456',
    submitterId: '789'
});

const quotes = await manager.quoteManager.getByGuild('123');
await manager.quoteManager.delete('quote-id');

// Birthdays
const birthday = await manager.birthdayManager.set({
    userId: '123',
    day: 15,
    month: 10,
    year: 1990,
    guildId: '456',
    channelId: '789'
});

const birthday = await manager.birthdayManager.getByUserId('123');
const all = await manager.birthdayManager.getAllPlain();
```

### Sequelize Initialization

Initialize database connection:

```typescript
import { getSequelize } from '@zeffuro/fakegaming-common/utils/sequelize';

const sequelize = getSequelize();
await sequelize.authenticate();
```

### Migrations

Run pending migrations:

```typescript
import { runMigrations } from '@zeffuro/fakegaming-common/utils/migrations';
import { getSequelize } from '@zeffuro/fakegaming-common/utils/sequelize';

const sequelize = getSequelize();
await runMigrations(sequelize);
```

### Logging

Get a configured logger:

```typescript
import { getLogger } from '@zeffuro/fakegaming-common/utils/logger';

const logger = getLogger('my-service');

logger.info('Hello world');
logger.error({ err }, 'Error occurred');
logger.debug({ data }, 'Debug info');
```

### Environment Variables

Bootstrap environment loading:

```typescript
import { bootstrapEnv } from '@zeffuro/fakegaming-common/utils/env';

// Loads .env.development or .env based on NODE_ENV
const env = bootstrapEnv({
    package: 'bot', // or 'api', 'dashboard'
    required: ['DISCORD_BOT_TOKEN', 'DATABASE_URL']
});
```

### Validation

Validate request data with Zod:

```typescript
import { validateBody, validateParams } from '@zeffuro/fakegaming-common/validation';
import { quoteSchema } from '@zeffuro/fakegaming-common/validation/schemas';
import type { Request, Response, NextFunction } from 'express';

// Express middleware
router.post('/quotes',
    validateBody(quoteSchema),
    async (req: Request, res: Response) => {
        // req.body is validated and typed
        const quote = req.body;
    }
);
```

### Testing

Use shared test helpers:

```typescript
import { describe, it, expect } from 'vitest';
import {
    setupCommandTest,
    expectEphemeralReply,
    createMockQuote
} from '@zeffuro/fakegaming-common/testing';

describe('my command', () => {
    it('should work', async () => {
        const { command, interaction, configManager } = await setupCommandTest(
            'path/to/command.js'
        );

        await command.execute(interaction);

        expectEphemeralReply(interaction, 'Success!');
    });
});
```

See [TESTING_API.md](./TESTING_API.md) for complete testing documentation.

## Development

### Scripts

```bash
# Build
pnpm build

# Watch mode
pnpm build --watch

# Test
pnpm test

# Test with coverage
pnpm test:coverage

# Lint
pnpm lint

# Type check
pnpm typecheck
```

### Pre-build Steps

Before building, the following auto-generation occurs:

1. **Bot manifest generation:** Scans bot commands and generates manifest
2. **Type generation:** Creates TypeScript types from OpenAPI spec

This is handled automatically by the build process.

## Exports

The package exports are organized by feature:

```typescript
// Models
export * from './models';

// Managers
export * from './managers';

// Utils
export * from './utils';

// Types
export * from './types';

// Validation
export * from './validation';

// Testing (not included in main index, import separately)
import * from '@zeffuro/fakegaming-common/testing';
```

## Testing This Package

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test managers/__tests__/quoteManager.test.ts

# Watch mode
pnpm test --watch

# Coverage
pnpm test:coverage
```

Tests are located alongside source files in `__tests__` directories.

## TypeScript Configuration

This package targets ESNext with NodeNext module resolution:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "strict": true,
    "experimentalDecorators": true
  }
}
```

See [TYPESCRIPT.md](../../TYPESCRIPT.md) for details.

## Generated Files

**Do not edit these files manually:**

- `src/manifest/bot-manifest.ts` - Auto-generated from bot commands
- `types/api.d.ts` - Auto-generated from OpenAPI spec
- `types/apiResponses.d.ts` - Auto-generated API response types

Regenerate with:

```bash
# From repository root
pnpm run gen:manifest
pnpm run gen:api-types
```

## Database Models Reference

| Model | Table | Description |
|-------|-------|-------------|
| UserConfig | UserConfigs | User preferences and settings |
| LeagueConfig | LeagueConfigs | League of Legends account links |
| ServerConfig | ServerConfigs | Guild-specific configuration |
| QuoteConfig | QuoteConfigs | User quotes |
| ReminderConfig | ReminderConfigs | Scheduled reminders |
| BirthdayConfig | BirthdayConfigs | User birthdays |
| TwitchStreamConfig | TwitchStreamConfigs | Twitch notification configs |
| YoutubeVideoConfig | YoutubeVideoConfigs | YouTube notification configs |
| PatchNoteConfig | PatchNoteConfigs | Game patch notes |
| PatchSubscriptionConfig | PatchSubscriptionConfigs | Patch note subscriptions |
| DisabledCommandConfig | DisabledCommandConfigs | Disabled commands per guild |
| DisabledModuleConfig | DisabledModuleConfigs | Disabled modules per guild |
| CacheConfig | CacheConfigs | Generic key-value cache |

See [SCHEMA.md](../../SCHEMA.md) for complete database documentation.

## Manager Reference

| Manager | Purpose |
|---------|---------|
| userManager | User configuration CRUD |
| serverManager | Guild configuration CRUD |
| quoteManager | Quote CRUD and search |
| reminderManager | Reminder CRUD |
| birthdayManager | Birthday CRUD and checking |
| twitchManager | Twitch config CRUD |
| youtubeManager | YouTube config CRUD |
| tiktokManager | TikTok config CRUD |
| patchNotesManager | Patch notes CRUD |
| disabledCommandManager | Disabled commands CRUD |
| disabledModuleManager | Disabled modules CRUD |
| cacheManager | Cache CRUD with TTL |
| notificationsManager | Notification deduplication |

## Dependencies

### Core

- `sequelize` - ORM for database models
- `sequelize-typescript` - TypeScript decorators
- `zod` - Runtime validation
- `pino` - Structured logging

### Database Drivers

- `pg` - PostgreSQL driver
- `sqlite3` - SQLite driver

### Development

- `typescript` - Type checking
- `vitest` - Testing framework

## Related Documentation

- [SCHEMA.md](../../SCHEMA.md) - Database schema
- [MIGRATIONS.md](../../MIGRATIONS.md) - Migration guide
- [TESTING.md](../../TESTING.md) - Testing guide
- [TESTING_API.md](./TESTING_API.md) - Testing helpers documentation
- [USAGE.md](./USAGE.md) - Usage examples
- [TYPESCRIPT.md](../../TYPESCRIPT.md) - TypeScript conventions

## Support

- Issues: [GitHub Issues](https://github.com/Zeffuro/fakegaming-bot/issues)
- Maintainer: [@Zeffuro](https://github.com/Zeffuro)
