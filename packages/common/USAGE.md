# @zeffuro/fakegaming-common Usage Guide

This library provides shared functionality for FakeGaming projects including database models, managers, and utilities.

## Installation

```bash
npm install @zeffuro/fakegaming-common
# or
pnpm add @zeffuro/fakegaming-common
```

## Basic Usage

### Full Package Import

```typescript
import { Models, Managers, Core, Discord, initSequelize } from '@zeffuro/fakegaming-common';

// Initialize database connection
await initSequelize({
  database: 'mydb',
  dialect: 'sqlite',
  storage: './data/mydb.sqlite'
});

// Use models and managers
const userManager = new Managers.UserManager();
const user = await userManager.findById(1);
```

### Optimized Imports

You can import only what you need using the sub-package entry points:

```typescript
// Import only models
import { UserConfig } from '@zeffuro/fakegaming-common/models';

// Import only managers
import { UserManager } from '@zeffuro/fakegaming-common/managers';

// Import only core utilities
import { getDataRoot } from '@zeffuro/fakegaming-common/core';

// Import only Discord utilities
import { exchangeCode } from '@zeffuro/fakegaming-common/discord';

// Import only cache utilities
import { getCacheManager } from '@zeffuro/fakegaming-common/utils/cache';
```

## Cache Management

For optimal performance, the cache manager is not automatically initialized. You need to explicitly initialize it:

```typescript
import { getCacheManager } from '@zeffuro/fakegaming-common';

// Initialize cache with Redis
const cacheManager = getCacheManager({
  redis: {
    host: 'localhost',
    port: 6379
  }
});

// Use cache
await cacheManager.set('key', 'value', 3600); // Cache for 1 hour
const value = await cacheManager.get('key');
```

## Database Models

All database models are available through the Models namespace or can be imported directly:

```typescript
// Import all models
import { Models } from '@zeffuro/fakegaming-common';
const UserConfig = Models.UserConfig;

// Or import specific models directly
import { UserConfig, ServerConfig } from '@zeffuro/fakegaming-common';
// Or from the models sub-entry point
import { UserConfig } from '@zeffuro/fakegaming-common/models';
```

## Managers

Managers provide higher-level APIs for working with models:

```typescript
import { UserManager, ServerManager } from '@zeffuro/fakegaming-common';
// Or from the managers sub-entry point
import { UserManager } from '@zeffuro/fakegaming-common/managers';

const userManager = new UserManager();
const user = await userManager.findOrCreate({ discordId: '123456789' });
```

## Environment Setup

You can use the Core utilities to set up your environment:

```typescript
import { Core } from '@zeffuro/fakegaming-common';

// Load environment variables from .env files
await Core.bootstrapEnv();

// Get project and data directories
const dataRoot = Core.getDataRoot();
const projectRoot = Core.getProjectRoot();
```
