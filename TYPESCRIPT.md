# TypeScript & ESLint Configuration

This document explains the TypeScript compiler options and ESLint rules used in this project.

## TypeScript Configuration

### Root Configuration (`tsconfig.json`)

```jsonc
{
  "compilerOptions": {
    "strict": true,                           // Enable all strict type-checking options
    "target": "ESNext",                       // Compile to latest ECMAScript features
    "module": "NodeNext",                     // Use Node.js ESM module resolution
    "moduleResolution": "NodeNext",           // Resolve modules using Node.js ESM rules
    "isolatedModules": true,                  // Ensure each file can be transpiled independently
    "esModuleInterop": true,                  // Better interop between CommonJS and ES modules
    "skipLibCheck": true,                     // Skip type checking of declaration files
    "forceConsistentCasingInFileNames": true, // Enforce consistent casing in imports
    "experimentalDecorators": true,           // Enable decorators (for Sequelize models)
    "baseUrl": "."                            // Base directory for resolving non-relative modules
  }
}
```

### Package-Specific Configurations

Each package extends the root config:

```jsonc
// packages/bot/tsconfig.json, packages/api/tsconfig.json, etc.
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",      // Output compiled JavaScript here
    "rootDir": "./src"       // Source code is in src/
  },
  "include": [
    "src",
    "src/__tests__/**/*"     // Include test files
  ]
}
```

## Key TypeScript Features

### Strict Mode

`"strict": true` enables all strict type-checking options:

- `strictNullChecks` - `null` and `undefined` must be explicitly handled
- `strictFunctionTypes` - Function types are checked more strictly
- `strictBindCallApply` - `bind`, `call`, `apply` are type-checked
- `strictPropertyInitialization` - Class properties must be initialized
- `noImplicitThis` - `this` expressions must have explicit types
- `alwaysStrict` - Parse files in strict mode and emit `"use strict"`
- `noImplicitAny` - Variables must have explicit types or inferable types

### ES Modules

We use ES modules (`.js` extensions in imports):

```typescript
// Correct - Include .js extension
import { getSequelize } from './sequelize.js';

// Incorrect - Missing extension
import { getSequelize } from './sequelize';
```

**Why:** TypeScript doesn't rewrite import paths, so we must use the runtime extension (`.js`) even when importing `.ts` files.

### Isolated Modules

`"isolatedModules": true` ensures each file can be transpiled independently. This means:

- **No `const enum`** - Use regular `enum` instead
- **No ambient declarations** - Use `.d.ts` files for type-only declarations
- **Export before use** - Can't re-export types without importing them first

### Experimental Decorators

`"experimentalDecorators": true` is required for Sequelize TypeScript decorators:

```typescript
import { Table, Column, Model } from 'sequelize-typescript';

@Table({ tableName: 'UserConfigs', timestamps: true })
export class UserConfig extends Model {
    @Column({ primaryKey: true })
    discordId!: string;
}
```

## ESLint Configuration

### Root Configuration (`eslint.config.mjs`)

We use the **flat config** format (ESLint 9+).

### Rules for TypeScript Files

```javascript
{
  files: ["**/*.ts", "**/*.tsx"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",    // Ignore unused args starting with _
        varsIgnorePattern: "^_",    // Ignore unused vars starting with _
      },
    ],
  }
}
```

#### No Unused Variables

The `@typescript-eslint/no-unused-vars` rule prevents unused variables, but allows intentional unused variables prefixed with `_`:

```typescript
// ✅ Good - Unused parameter prefixed with _
function processData(_metadata: Metadata, data: string) {
    return data.trim();
}

// ✅ Good - Unused variable prefixed with _
const [_ignored, value] = array;

// ❌ Bad - Unused variable without prefix
function processData(metadata: Metadata, data: string) {
    return data.trim();  // 'metadata' is unused!
}
```

**Pro tip for AI assistants:** When a function parameter is required by an interface but not used in the implementation, prefix it with `_` to avoid linting errors.

### Rules for Declaration Files

```javascript
{
  files: ["**/*.d.ts"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/ban-types": "off",
  }
}
```

Declaration files (`.d.ts`) have relaxed rules since they only contain type definitions.

### Rules for Next.js

```javascript
{
  files: ["packages/dashboard/**/*.{js,jsx,ts,tsx}"],
  plugins: {
    "@next/next": nextPlugin,
  },
  rules: {
    ...nextPlugin.configs["core-web-vitals"].rules,
  }
}
```

Dashboard code uses Next.js-specific rules (React hooks, image optimization, etc.).

## Common Patterns

### Handling Unused Parameters

When implementing interfaces that require parameters you don't use:

```typescript
// Interface requires these parameters
interface CommandHandler {
    execute(interaction: Interaction, args: string[]): Promise<void>;
}

// Implementation only needs interaction
class MyCommand implements CommandHandler {
    // ✅ Prefix unused parameter with _
    async execute(interaction: Interaction, _args: string[]) {
        await interaction.reply('Hello!');
    }
}
```

### Optional Properties vs Undefined

With strict null checks, use optional properties:

```typescript
// ✅ Good - Optional property
interface User {
    name: string;
    nickname?: string;  // May be undefined
}

// ❌ Bad - Explicit undefined
interface User {
    name: string;
    nickname: string | undefined;  // Requires explicit undefined checks
}
```

### Non-Null Assertion

Use sparingly when you're certain a value is not null:

```typescript
// ✅ Good - When you know it's not null
const user = users.find(u => u.id === id)!;

// ❌ Bad - Overusing non-null assertion
const name = user!.profile!.name!;

// ✅ Better - Optional chaining
const name = user?.profile?.name ?? 'Unknown';
```

### Type Assertions

Use `as` for type assertions:

```typescript
// ✅ Good - Type assertion
const input = event.target as HTMLInputElement;

// ❌ Bad - Old-style angle bracket syntax
const input = <HTMLInputElement>event.target;
```

## Handling Import Errors

### "Cannot find module" with .js extension

**Problem:** TypeScript shows an error for `.js` extensions in imports.

**Solution:** This is expected! TypeScript resolves `.ts` files but preserves `.js` in output. The code will run correctly.

### "Module has no exported member"

**Problem:** Import fails even though the export exists.

**Solution:** 
1. Rebuild the package: `pnpm build`
2. Check the export in `index.ts`
3. Check the export map in `package.json`

### Circular Dependencies

**Problem:** Two files import each other, causing runtime errors.

**Solution:**
1. Extract shared types to a separate file
2. Use dynamic imports: `const module = await import('./module.js')`
3. Restructure code to remove circular dependency

## Testing with Vitest

### Mocking Modules

```typescript
import { vi } from 'vitest';

// ✅ Mock a module
vi.mock('./module.js', () => ({
    myFunction: vi.fn(),
}));

// ✅ Mock a function
const mockFn = vi.fn();
mockFn.mockResolvedValue('result');
```

### Type-Safe Mocks

```typescript
import { vi, Mock } from 'vitest';

// ✅ Type-safe mock
const mockFetch = fetch as Mock;
mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
```

## Building and Compilation

### Build Order

Due to workspace dependencies:

1. **Build common first:** `pnpm --filter @zeffuro/fakegaming-common run build`
2. **Build other packages:** `pnpm build` (builds all)

### Watch Mode

For development with automatic recompilation:

```bash
# Bot in watch mode (no compilation, uses tsx)
pnpm start:bot:dev

# Build common in watch mode
cd packages/common
pnpm build --watch
```

## Common Issues

### Issue: "Cannot use import statement outside a module"

**Cause:** Missing `"type": "module"` in `package.json`

**Solution:** All packages have `"type": "module"` set. If you see this error, check `package.json`.

### Issue: Decorators not working

**Cause:** `experimentalDecorators` not enabled

**Solution:** Already enabled in root `tsconfig.json`. Make sure package extends root config.

### Issue: "Cannot find module '@zeffuro/fakegaming-common'"

**Cause:** Common package not built or not installed

**Solution:**
```bash
pnpm install
pnpm --filter @zeffuro/fakegaming-common run build
```

## For AI Assistants

When generating code for this project:

1. **Use `.js` extensions in imports** - Even for `.ts` files
2. **Prefix unused variables with `_`** - Avoids linting errors
3. **Use ES modules** - `import`/`export`, not `require`
4. **Use strict types** - No implicit `any`, handle `null`/`undefined`
5. **Use optional chaining** - `user?.name` instead of `user && user.name`
6. **Use nullish coalescing** - `value ?? default` instead of `value || default`
7. **Export types explicitly** - Use `export type` for type-only exports
8. **Follow existing patterns** - Check existing files for consistent style

### Example: Adding a New Model

```typescript
// packages/common/src/models/my-model.ts
import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({ tableName: 'MyModels', timestamps: true })
export class MyModel extends Model {
    @Column({ primaryKey: true, autoIncrement: true })
    id!: number;
    
    @Column({ type: DataType.STRING, allowNull: false })
    name!: string;
    
    @Column({ type: DataType.STRING, allowNull: true })
    description?: string;
}

// Export from index
export * from './my-model.js';  // Note .js extension
```

---

**Questions?** Check existing code for examples, or refer to [TypeScript docs](https://www.typescriptlang.org/docs/) and [ESLint docs](https://eslint.org/docs/latest/).
