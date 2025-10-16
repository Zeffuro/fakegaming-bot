# Contributing to fakegaming-bot Monorepo

Thanks for your interest in contributing! Please follow these guidelines to get started.

---

## Monorepo Structure

This project is a monorepo managed with **pnpm workspaces**. It contains multiple packages:

- `packages/api` — Express REST API for external integrations
- `packages/bot` — The Discord bot (commands, services, integrations)
- `packages/common` — Shared code (models, types, utilities)
- `packages/dashboard` — Next.js dashboard for bot management
- `data/` — Persistent data, assets, and config (used by the bot)
- `migrations/` — Database migration scripts
- `scripts/` — Utility scripts (e.g., codegen, migration helpers)

---

## Getting Started

> **Package Manager:**  
> This project **requires [pnpm](https://pnpm.io/)** for monorepo workspace management.  
> pnpm is mandatory due to workspace dependencies and to avoid deep `node_modules` nesting issues on Windows.

1. **Fork the repo and clone your fork**
2. **Install pnpm** if you don't have it:
   ```bash
   npm install -g pnpm
   ```
3. **Install all dependencies** for all packages:
   ```bash
   pnpm install
   ```
4. Copy the root `.env.example` to `.env` in the root of the repository:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your credentials. See comments in `.env.example` for details.
5. Start the bot in development from the root:
   ```bash
   pnpm start:bot:dev
   ```
   Or, from the bot package:
   ```bash
   cd packages/bot
   pnpm start:dev
   ```

### Using Docker Compose (Optional)

- You can use Docker Compose to run the bot and its dependencies:
  ```bash
  docker-compose up --build
  ```
- The root `.env` file is used for all services.
- See `docker-compose.yml` for service definitions and volume mappings.
- To stop and remove containers:
  ```bash
  docker-compose down
  ```

---

## Local Development Setup

**1. Install dependencies**

From the repository root, run:

```bash
pnpm install
```


**2. Set up environment variables**

For **local development**, copy `.env.example` to `.env.development` in each package:

```bash
cp packages/bot/.env.example packages/bot/.env.development
cp packages/api/.env.example packages/api/.env.development
cp packages/dashboard/.env.example packages/dashboard/.env.development
```

Then edit each `.env.development` file with your **development credentials**:
- Use SQLite for the database (set `DATABASE_PROVIDER=sqlite`, no `DATABASE_URL` needed)
- Use development Discord tokens/IDs
- Use test API keys for third-party services

For **production or live data testing**, create `.env` files instead:

```bash
cp packages/bot/.env.example packages/bot/.env
cp packages/api/.env.example packages/api/.env
cp packages/dashboard/.env.example packages/dashboard/.env
```

**Environment File Loading:**
- `start:dev` scripts set `NODE_ENV=development` → loads `.env.development`
- `start` scripts set `NODE_ENV=production` → loads `.env`
- Falls back to `.env` if the environment-specific file doesn't exist

**3. Build the common package**

The bot, API, and dashboard all depend on `@zeffuro/fakegaming-common`. Build it first:

```bash
pnpm --filter @zeffuro/fakegaming-common run build
```

**4. Run services locally**

From the repository root:

```bash
# Start the bot in development mode
pnpm start:bot:dev

# Start the API in development mode
pnpm start:api:dev

# Start the dashboard in development mode
pnpm start:dashboard:dev
```

These commands use `tsx` for TypeScript execution without compilation and hot-reload.

---

## Docker Compose Setup

For **containerized deployment** (production-like environment):

### Production Deployment

**1. Set up the root `.env` file**

```bash
cp .env.example .env
```

Edit the root `.env` file with database credentials and volume paths.

**2. Set up service `.env` files**

```bash
cp packages/bot/.env.example packages/bot/.env
cp packages/api/.env.example packages/api/.env
cp packages/dashboard/.env.example packages/dashboard/.env
```

Edit each service's `.env` file with production credentials.

**3. Start services**

```bash
docker-compose up -d
```

- Uses pre-built images from Docker Hub (`zeffuro/fakegaming-*:latest`)
- The root `.env` file is used for Docker Compose variables (database credentials, volume mappings)
- Each service's `.env` file is loaded for service-specific configuration
- `DATABASE_URL` is automatically constructed and injected from root `.env` variables
- Runs with PostgreSQL database

**4. Stop services**

```bash
docker-compose down
```

---

### Local Docker Testing

For **testing Dockerized builds locally** with development credentials:

**1. Set up `.env.development` files** (if not already done for local dev):

```bash
cp packages/bot/.env.example packages/bot/.env.development
cp packages/api/.env.example packages/api/.env.development
cp packages/dashboard/.env.example packages/dashboard/.env.development
```

Edit each `.env.development` file with development credentials.

**2. Build and start services**

```bash
docker-compose -f docker-compose.local.yml up --build -d
```

**What this does:**
- ✅ Builds Docker images from source (not from Docker Hub)
- ✅ Uses `.env.development` files (development credentials)
- ✅ Uses SQLite database (no PostgreSQL container)
- ✅ Exposes API on port 3001 and Dashboard on port 3000
- ✅ Perfect for testing Dockerfiles before pushing to production

**3. Access services**

- Dashboard: http://localhost:3000
- API: http://localhost:3001/api

**4. Rebuild after code changes**

```bash
docker-compose -f docker-compose.local.yml up --build -d
```

**5. Stop services**

```bash
docker-compose -f docker-compose.local.yml down
```

---

## Code Style

- Use TypeScript for all source files.
- Prefer ES modules (`import/export`).
- Use 4-space indentation.
- Write TSDoc comments for exported functions/classes.
- **TypeScript & ESLint:** See [TYPESCRIPT.md](../TYPESCRIPT.md) for compiler options and linting rules.
- Lint all packages with:
  ```bash
  npm run lint
  ```
  Or run `npm run lint` in a specific package directory.

### Important Code Conventions

- **Unused variables:** Prefix with `_` to avoid linting errors (e.g., `_unusedParam`)
- **Import extensions:** Always use `.js` extension for imports, even for `.ts` files
- **ES modules:** Use `import`/`export`, not `require`/`module.exports`
- **Strict types:** No implicit `any`, handle `null`/`undefined` explicitly
- **Optional chaining:** Prefer `user?.name` over `user && user.name`

See [TYPESCRIPT.md](../TYPESCRIPT.md) for detailed TypeScript configuration and best practices.

---

## Testing & Coverage

- Test runner: Vitest per package (`vitest.config.ts` in each).
- Run tests for all packages:
  ```bash
  pnpm test
  ```
- Run tests with coverage:
  ```bash
  pnpm test:coverage
  ```
- Coverage thresholds (enforced per package):
  - Lines/Statements: 80%
  - Branches: 75%
  - Functions: 80%
- Notes:
  - Some generated or declarative wiring files are excluded from coverage (for example, the auto-generated bot manifest, and schema override registries). Core behavior is covered by unit and integration tests.
  - Prefer focused unit tests for pure utilities and model logic; use API integration tests (supertest) for middleware like rate limiting and CSRF.

## Import/Export & TypeScript Conventions

- Use ES modules only; no CommonJS.
- Always use `.js` extension for local imports, even for `.ts` sources.
- Use named exports only; avoid `export default`.
- Strict TypeScript: no implicit `any`; handle `null`/`undefined` explicitly.
- Prefix intentionally unused variables/parameters with `_` to satisfy lint rules.

## Shared Code & Generated Artifacts

- Put shared types, models, and utilities in `packages/common`. If you find duplication across packages, refactor into common.
- The bot command manifest in `packages/common/src/manifest/bot-manifest.ts` is auto-generated. Do not edit it manually; regenerate via:
  ```bash
  pnpm run gen:manifest
  ```
- Schema validation overrides are defined centrally (common/validation); avoid duplicating validation logic in services.

## Security & Middleware

- Auth: Use shared JWT helpers from `@zeffuro/fakegaming-common` and enforce issuer/audience. Dashboard uses HttpOnly cookies; API uses Bearer.
- CSRF: Mutating routes must enforce CSRF using the shared core (Next adapter in Dashboard, Express middleware in API). Prefer the base router in API which auto-enforces CSRF on POST/PUT/PATCH/DELETE.
- Rate limiting: API uses a DB-backed sliding window limiter with standard headers; integration tests assert headers and 429 behavior. Avoid duplicating limiter logic in features.

---

## Adding Features & Commands

- Add new Discord commands in `packages/bot/src/modules/yourmodule/`.
- Shared code (models, types, utilities) should go in `packages/common`.
- Dashboard features go in `packages/dashboard`.
- Export a `data` object (for Discord command registration) and an `execute` function for new commands.
- Register your module in the command loader if needed.

---

## Database Changes & Migrations

- **Models:** All database models are defined in `packages/common` (typically in `packages/common/src/models/`).
- **Schema changes:** Any change to the database schema (adding/removing fields, tables, etc.) requires a new migration
  script in the `migrations/` directory.
- **Writing migrations:**
    - Create a new migration file in `migrations/` (follow the naming convention: `YYYYMMDD-description.ts`).
    - Write migrations in TypeScript, following the style of existing migration files.
- **Running migrations:**
    - Use the provided migration scripts or commands (see `scripts/` or package.json) to apply migrations to your
      database.
    - Always run migrations and ensure your database is up to date before running or testing the bot.

---

## Adding Preloaders

- Add your asset or service preloader to `packages/bot/src/core/preloadModules.ts`.
- Preloaders should be async functions.

---

## Writing Patch Notes Fetchers

- Extend `BasePatchNotesFetcher` in `packages/bot/src/services/patchfetchers/`.
- Implement game-specific logic (see `leaguePatchNotesFetcher.ts` for an example).
- Register your fetcher in `loadPatchNoteFetchers.ts`.

---

## Branching & Pull Requests

- Create feature branches from `main`.
- Submit PRs with a clear description of your changes.
- Link related issues if applicable.
- If your change affects multiple packages, make sure to test all affected areas.

---

## Running Tests

Unit tests use [Vitest](https://vitest.dev/).

- Run all tests for all packages:
  ```bash
  pnpm test
  ```
- Or, run tests in a specific package:
  ```bash
  cd packages/bot
  pnpm test
  ```
- Test files are located in `src/modules/*/__tests__/` and `src/services/__tests__/` (for the bot), and similar locations in
  other packages.

### Writing Tests

- Use `.test.ts` files for unit tests.
- Vitest is configured in each package's `vitest.config.ts`
- Mock Discord.js interactions as needed
- Prefer testing command logic and service functions in isolation.

### Mocking

- Use `vi.mock()` for mocking modules (Vitest syntax, not Jest)
- Use `vi.fn()` for mocking functions and methods

---

## Spelling Dictionary

- The dictionary is located at `.idea/dictionaries/team.dic`.
- If you add new domain-specific words, add them to this file and commit the change.
- WebStorm will automatically use this dictionary for spellchecking.

---

## Reporting Issues

- Use [GitHub Issues](https://github.com/Zeffuro/fakegaming-bot/issues) for bugs, features, and questions.

---

## Continuous Integration (CI)

This project uses **GitHub Actions** for continuous integration:

- **Builds, lints, and tests** all packages on every pull request and push to `main`.
- **Checks migrations** and code formatting.
- Ensures all code passes before merging.
- See the [CI workflow](https://github.com/Zeffuro/fakegaming-bot/actions) for details.

---

## Code of Conduct

Participation in this project is governed by our [Code of Conduct](./CODE_OF_CONDUCT.md). Please be respectful and help
us keep the community welcoming.

---

## Security Policy

If you discover a security vulnerability, please see [SECURITY.md](./SECURITY.md) for how to report it privately.

---

## License

By contributing, you agree that your code will be released under the AGPLv3.

- **You can use, modify, and share this project, but if you deploy it or make it public, you must also share your
  changes under the same license.**
- See [LICENSE](./LICENSE) for the full text.

---

Maintained by [@Zeffuro](https://github.com/Zeffuro)