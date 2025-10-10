# Testing Guide for fakegaming-bot

This guide explains how to write effective tests for the fakegaming-bot monorepo using Vitest and our shared testing utilities.

## Table of Contents

1. [Philosophy](#philosophy)
2. [Test Structure](#test-structure)
3. [ESM Module Mocking](#esm-module-mocking)
4. [Shared Testing Utilities](#shared-testing-utilities)
5. [Service Tests](#service-tests)
6. [Command Tests](#command-tests)
7. [Common Patterns](#common-patterns)
8. [Troubleshooting](#troubleshooting)

---

## Philosophy

**DRY (Don't Repeat Yourself)**: All shared testing logic belongs in `packages/common/src/testing/`. Never duplicate mock setup, test utilities, or helper functions across test files.

**Test Layers**:
- **Unit tests**: Mock all external dependencies (DB, Discord API, external APIs)
- **Integration tests**: Test actual DB operations (only in `packages/common`)
- **No E2E tests**: We don't spin up real Discord bots in tests

**Fast & Isolated**: Each test should run in isolation and complete quickly (<100ms per test).

---

## Test Structure

### File Organization

```
packages/
├── bot/
│   └── src/
│       ├── services/
│       │   ├── __tests__/
│       │   │   ├── birthdayService.test.ts
│       │   │   ├── reminderService.test.ts
│       │   │   └── patchNotesService.test.ts
│       │   ├── birthdayService.ts
│       │   └── reminderService.ts
│       └── modules/
│           └── quotes/
│               └── commands/
│                   ├── __tests__/
│                   │   └── quote-add.test.ts
│                   └── quote-add.ts
├── common/
│   └── src/
│       └── testing/
│           ├── index.ts              # Export all testing utilities
│           ├── mocks/
│           │   ├── discordMock.ts    # Discord.js mocks
│           │   ├── managerMock.ts    # Manager mocks
│           │   └── modelMock.ts      # Model mocks
│           ├── helpers/
│           │   └── serviceTestHelpers.ts  # Shared test helpers
│           └── utils/
│               └── testUtils.ts      # Setup functions
```

### Test File Template

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupServiceTest, createMockTextChannel } from '@zeffuro/fakegaming-common/testing';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';

// 1. Mock external dependencies at top-level BEFORE importing SUT
vi.mock('external-library', () => ({
    exportedFunction: vi.fn(),
}));

// 2. Use vi.hoisted() for mocks needed in vi.mock() factories
const { mockExternalFn } = vi.hoisted(() => ({
    mockExternalFn: vi.fn(),
}));

// 3. Import the system under test (SUT) AFTER mocks
import { functionToTest } from '../myService.js';

describe('myService', () => {
    let client: Awaited<ReturnType<typeof setupServiceTest>>['client'];
    let configManager: ReturnType<typeof getConfigManager>;

    beforeEach(async () => {
        // 4. Setup test environment
        const setup = await setupServiceTest();
        client = setup.client;
        configManager = setup.configManager;

        // 5. Clear mocks (NOT resetAllMocks - that breaks manager mocks)
        vi.clearAllMocks();
    });

    it('should do something', async () => {
        // 6. Arrange: Setup test data and mocks
        const mockData = { /* ... */ };
        vi.spyOn(configManager.someManager, 'someMethod').mockResolvedValue(mockData);

        // 7. Act: Call the function under test
        await functionToTest(client);

        // 8. Assert: Verify behavior
        expect(configManager.someManager.someMethod).toHaveBeenCalled();
    });
});
```

---

## ESM Module Mocking

**Critical Rule**: In ESM, `vi.mock()` must be called **before** importing the module you're testing.

### ✅ Correct Pattern

```typescript
// 1. Mock dependencies FIRST
vi.mock('../../utils/helper.js', () => ({
    helperFunction: vi.fn(() => 'mocked'),
}));

// 2. THEN import the SUT
import { myFunction } from '../myService.js';

// 3. Use in tests
it('works', () => {
    const result = myFunction();
    expect(result).toBe('mocked');
});
```

### ❌ Wrong Pattern

```typescript
// DON'T DO THIS - imports before mocks
import { myFunction } from '../myService.js';

vi.mock('../../utils/helper.js', () => ({
    helperFunction: vi.fn(() => 'mocked'),
}));
// ⚠️ Too late! myFunction already bound to real helper
```

### Using vi.hoisted()

When you need to access mock functions inside a `vi.mock()` factory:

```typescript
const { mockFetch } = vi.hoisted(() => ({
    mockFetch: vi.fn(async () => ({ data: 'test' })),
}));

vi.mock('../../loaders/dataLoader.js', () => ({
    loadData: mockFetch,
}));

import { processData } from '../myService.js';

it('should call the loader', async () => {
    await processData();
    expect(mockFetch).toHaveBeenCalled();
});
```

### Mocking Node.js Built-ins

```typescript
vi.mock('fs', () => ({
    readFileSync: vi.fn(() => 'file contents'),
    existsSync: vi.fn(() => true),
}));
```

### Mocking npm Packages

```typescript
// Mock axios
vi.mock('axios');
import axios from 'axios';

it('should call API', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { result: 'ok' } });
    // ... test code
});
```

---

## Shared Testing Utilities

All shared utilities are in `@zeffuro/fakegaming-common/testing`.

### Setup Functions

#### `setupServiceTest(options?)`

Sets up a complete test environment for service tests.

```typescript
const { client, configManager } = await setupServiceTest({
    client: { /* Discord client overrides */ },
    managerOverrides: {
        birthdayManager: {
            getAllPlain: vi.fn().mockResolvedValue([]),
        },
    },
});
```

**Returns**:
- `client`: Mocked Discord.js Client
- `configManager`: Mocked ConfigManager with all managers

**✨ New in v2:** Manager mocks are now **fully dynamic**! All manager methods are auto-discovered from the real manager classes. You only need to override specific methods you're testing.

#### `setupCommandTest(commandPath, options?)`

Sets up environment for command tests.

```typescript
const { command, interaction, client, configManager } = await setupCommandTest(
    'modules/quotes/commands/quote-add.js',
    {
        interaction: { guildId: 'test-guild' },
    }
);
```

### Manager Mocks (Dynamic System) ⭐ NEW

#### `createMockConfigManager(overrides?)`

Creates a complete mock ConfigManager by **automatically discovering** all managers from the real ConfigManager class.

```typescript
const configManager = createMockConfigManager({
    birthdayManager: {
        // Only override what you need - all other methods auto-mocked!
        getAllPlain: vi.fn().mockResolvedValue([mockBirthday]),
    },
});
```

**How it works:**
1. Inspects the real `ConfigManager` class
2. Discovers all manager properties (birthdayManager, reminderManager, etc.)
3. For each manager, auto-discovers all custom methods via reflection
4. Auto-mocks all `BaseManager` methods
5. Applies your overrides

**Adding a new manager:** Just add it to `ConfigManager` - the mock system discovers it automatically!

```typescript
// In ConfigManager
export class ConfigManager {
    // ...existing managers...
    settingsManager = new SettingsManager(); // ✅ Automatically mocked!
}
```

#### `createMockManager<T>(ManagerClass, overrides?)`

Create a standalone mock for a specific manager type:

```typescript
import { BirthdayManager } from '@zeffuro/fakegaming-common/managers';

const mockBirthdayManager = createMockManager(BirthdayManager, {
    getAllPlain: vi.fn().mockResolvedValue([]),
});
```

### Discord Mocks

#### `createMockClient(overrides?)`

```typescript
const client = createMockClient({
    users: {
        fetch: vi.fn(async (id) => mockUser),
    },
    channels: {
        fetch: vi.fn(async (id) => mockChannel),
        cache: new Map(), // For cache.get() / cache.set()
    },
});
```

#### `createMockTextChannel(overrides?)`

Full Discord TextChannel mock with all properties:

```typescript
const channel = createMockTextChannel({
    id: 'channel-123',
    send: vi.fn(async (msg) => ({ id: 'msg-123' })),
});
```

#### `createMockChannelWithSend(overrides?)` ⭐ NEW

**Simplified channel mock** for service tests that only need send functionality:

```typescript
const channel = createMockChannelWithSend({
    id: 'channel-456',
});

await channel.send({ content: 'Hello!' });
expect(channel.send).toHaveBeenCalled();
```

**When to use:**
- ✅ Service tests (birthdayService, reminderService, etc.)
- ❌ Command tests → Use `createMockTextChannel()` for full features

#### `createMockUserWithDM(overrides?)` ⭐ NEW

**Simplified user mock** for testing DM functionality:

```typescript
const user = createMockUserWithDM({ id: 'user-123' });

await user.send({ embeds: [embed] });
expect(user.send).toHaveBeenCalledWith({ embeds: expect.any(Array) });
```

### Service Test Helpers ⭐ NEW

#### `createTestDate(dateString)`

```typescript
const testDate = createTestDate('2025-10-06');
await checkBirthdays(client, testDate);
```

#### `advanceTime(ms)` / `resetTime()`

```typescript
vi.useFakeTimers();
advanceTime(3600000); // Advance 1 hour
// ... test time-dependent code
resetTime();
```

---

## Service Tests

Service tests mock all external dependencies and focus on business logic.

### Example: Birthday Service

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setupServiceTest, createMockChannelWithSend, createMockBirthday, createTestDate } from '@zeffuro/fakegaming-common/testing';
import { checkAndAnnounceBirthdays } from '../birthdayService.js';

describe('birthdayService', () => {
    let client: Awaited<ReturnType<typeof setupServiceTest>>['client'];
    let configManager: ReturnType<typeof getConfigManager>;

    beforeEach(async () => {
        const setup = await setupServiceTest();
        client = setup.client;
        configManager = setup.configManager;
    });

    it('should announce birthdays for users today', async () => {
        const testDate = createTestDate('2025-10-06');
        const birthday = createMockBirthday({
            userId: 'user-123',
            channelId: 'channel-123',
            day: 6,
            month: 10,
            year: 2000,
        });

        const mockChannel = createMockChannelWithSend({ id: 'channel-123' });

        vi.spyOn(configManager.birthdayManager, 'getAllPlain').mockResolvedValue([birthday]);
        vi.spyOn(configManager.birthdayManager, 'isBirthdayToday').mockReturnValue(true);
        vi.spyOn(client.channels, 'fetch').mockResolvedValue(mockChannel as any);

        await checkAndAnnounceBirthdays(client, testDate);

        expect(mockChannel.send).toHaveBeenCalledWith(
            expect.stringContaining('Happy birthday <@user-123> (turning 25)!')
        );
    });

    it('should skip birthdays not today', async () => {
        const testDate = createTestDate('2025-10-07');
        const birthday = createMockBirthday({ day: 6, month: 10 });

        vi.spyOn(configManager.birthdayManager, 'getAllPlain').mockResolvedValue([birthday]);
        vi.spyOn(configManager.birthdayManager, 'isBirthdayToday').mockReturnValue(false);
        vi.spyOn(client.channels, 'fetch');

        await checkAndAnnounceBirthdays(client, testDate);

        expect(client.channels.fetch).not.toHaveBeenCalled();
    });
});
```

### Example: Reminder Service with Error Handling

```typescript
it('should continue processing after send failure', async () => {
    const now = Date.now();
    const mockUser1 = createMockUserWithDM({ id: 'user-1' });
    const mockUser2 = createMockUserWithDM({ id: 'user-2' });
    
    mockUser1.send.mockRejectedValue(new Error('DM blocked'));

    const reminders = [
        createMockReminder({ id: 'r1', userId: 'user-1', timestamp: now - 1000 }),
        createMockReminder({ id: 'r2', userId: 'user-2', timestamp: now - 1000 }),
    ];

    vi.spyOn(configManager.reminderManager, 'getAllPlain').mockResolvedValue(reminders);
    vi.spyOn(client.users, 'fetch')
        .mockResolvedValueOnce(mockUser1 as any)
        .mockResolvedValueOnce(mockUser2 as any);
    vi.spyOn(configManager.reminderManager, 'removeReminder').mockResolvedValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await checkAndSendReminders(client);

    expect(mockUser2.send).toHaveBeenCalled();
    expect(configManager.reminderManager.removeReminder).toHaveBeenCalledWith('r1');
    expect(configManager.reminderManager.removeReminder).toHaveBeenCalledWith('r2');
});
```

---

## Command Tests

Command tests verify slash command execution and interaction responses.

### Example: Quote Add Command

```typescript
import { describe, it, expect } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';

describe('/quote add', () => {
    it('should add a quote successfully', async () => {
        const { command, interaction, configManager } = await setupCommandTest(
            'modules/quotes/commands/quote-add.js',
            {
                interaction: {
                    guildId: 'guild-123',
                    user: { id: 'user-123' },
                    options: {
                        getString: vi.fn((name) => {
                            if (name === 'quote') return 'Test quote';
                            if (name === 'author') return 'Author Name';
                            return null;
                        }),
                    },
                },
            }
        );

        vi.spyOn(configManager.quoteManager, 'add').mockResolvedValue({ id: 'quote-1' } as any);

        await command.execute(interaction);

        expect(configManager.quoteManager.add).toHaveBeenCalledWith(
            expect.objectContaining({
                quote: 'Test quote',
                authorId: 'Author Name',
                guildId: 'guild-123',
            })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Quote added'),
            })
        );
    });
});
```

---

## Common Patterns

### Pattern 1: Mocking External APIs

```typescript
vi.mock('axios');
import axios from 'axios';

it('should fetch data from external API', async () => {
    vi.mocked(axios.get).mockResolvedValue({
        data: { result: 'success' },
    });

    const result = await fetchExternalData();

    expect(result).toEqual({ result: 'success' });
    expect(axios.get).toHaveBeenCalledWith('https://api.example.com/data');
});
```

### Pattern 2: Testing Time-Dependent Code

```typescript
import { vi } from 'vitest';

it('should only process due reminders', async () => {
    vi.useFakeTimers();
    const now = new Date('2025-10-06T12:00:00Z');
    vi.setSystemTime(now);

    const futureReminder = createMockReminder({
        timestamp: now.getTime() + 10000, // 10 seconds in future
    });

    vi.spyOn(configManager.reminderManager, 'getAllPlain').mockResolvedValue([futureReminder]);

    await checkAndSendReminders(client);

    expect(client.users.fetch).not.toHaveBeenCalled();

    vi.useRealTimers();
});
```

### Pattern 3: Testing Error Paths

```typescript
it('should handle errors gracefully', async () => {
    vi.spyOn(configManager.someManager, 'someMethod').mockRejectedValue(
        new Error('Database error')
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await serviceFunction(client);

    expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Database error')
    );
});
```

### Pattern 4: Testing Pagination

```typescript
it('should handle paginated results', async () => {
    const page1 = [createMockQuote({ id: '1' }), createMockQuote({ id: '2' })];
    const page2 = [createMockQuote({ id: '3' })];

    vi.spyOn(configManager.quoteManager, 'getMany')
        .mockResolvedValueOnce(page1 as any)
        .mockResolvedValueOnce(page2 as any);

    const results = await getAllQuotes();

    expect(results).toHaveLength(3);
});
```

### Pattern 5: Verifying Embed Content

```typescript
it('should send embed with correct data', async () => {
    const mockChannel = createMockChannelWithSend();

    await sendPatchNote(client, patchNote);

    expect(mockChannel.send).toHaveBeenCalledWith({
        embeds: [
            expect.objectContaining({
                data: expect.objectContaining({
                    title: expect.stringContaining('Version 1.0'),
                    description: expect.any(String),
                }),
            }),
        ],
    });
});
```

---

## Troubleshooting

### Issue: "Model not initialized" Error

**Cause**: Your test is calling real Sequelize models instead of mocks.

**Solution**: Ensure `vi.mock('@zeffuro/fakegaming-common/managers')` is called at top-level in `vitest.setup.ts`.

```typescript
// packages/bot/src/vitest.setup.ts
vi.mock('@zeffuro/fakegaming-common/managers', async () => {
    const testing = await vi.importActual('@zeffuro/fakegaming-common/testing');
    return {
        getConfigManager: vi.fn(() => testing.getActiveMockConfigManager()),
    };
});
```

### Issue: "Cannot read properties of undefined"

**Cause**: `vi.clearAllMocks()` or `vi.resetAllMocks()` is clearing the mock config manager.

**Solution**: Use selective clearing:

```typescript
beforeEach(async () => {
    const setup = await setupServiceTest();
    client = setup.client;
    configManager = setup.configManager;

    // DON'T do this:
    // vi.clearAllMocks();

    // DO this:
    vi.mocked(myMockFunction).mockClear();
});
```

### Issue: Mock Not Applied

**Cause**: Mock is registered after importing the SUT.

**Solution**: Always mock before import:

```typescript
// ✅ Correct order
vi.mock('./dependency.js', () => ({ ... }));
import { myFunction } from './myModule.js';

// ❌ Wrong order
import { myFunction } from './myModule.js';
vi.mock('./dependency.js', () => ({ ... }));
```

### Issue: "Module not found" in Mock Path

**Cause**: Relative path is incorrect from test file perspective.

**Solution**: Check the path carefully:

```typescript
// If your test is in: src/services/__tests__/myService.test.ts
// And you're mocking:  src/loaders/dataLoader.ts
// The path should be:  ../../loaders/dataLoader.js
vi.mock('../../loaders/dataLoader.js', () => ({ ... }));
```

### Issue: Tests Pass Individually but Fail Together

**Cause**: Test pollution - state leaking between tests.

**Solution**:
1. Use `beforeEach` to reset state
2. Don't use global variables
3. Clear specific mocks, not all mocks

```typescript
let localState: any;

beforeEach(() => {
    localState = null; // Reset local state
    vi.mocked(myMock).mockClear(); // Clear specific mocks
});
```

---

## Best Practices Checklist

- [ ] Use `setupServiceTest()` or `setupCommandTest()` for setup
- [ ] Mock external dependencies with `vi.mock()` at top-level
- [ ] Import SUT **after** all `vi.mock()` calls
- [ ] Use `vi.hoisted()` for mock values needed in factories
- [ ] Use factory functions (`createMock*`) from common/testing
- [ ] Clear specific mocks in `beforeEach`, not `vi.clearAllMocks()`
- [ ] Test both success and error paths
- [ ] Verify calls with `expect(...).toHaveBeenCalledWith(...)`
- [ ] Use `vi.spyOn()` for manager methods
- [ ] Keep tests focused and isolated
- [ ] Mock console methods when testing error logging
- [ ] Use descriptive test names that explain behavior
- [ ] Group related tests in `describe` blocks

---

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)
- [Discord.js Guide](https://discordjs.guide/)
- Project-specific: See `ARCHITECTURE.md` for code organization
