# Contributing to fakegaming-bot Monorepo

Thanks for your interest in contributing! Please follow these guidelines to get started.

---

## Monorepo Structure

This project is a monorepo managed with npm workspaces. It contains multiple packages:

- `packages/api` — Express REST API for external integrations
- `packages/bot` — The Discord bot (commands, services, integrations)
- `packages/common` — Shared code (models, types, utilities)
- `packages/dashboard` — Next.js dashboard for bot management
- `data/` — Persistent data, assets, and config (used by the bot)
- `migrations/` — Database migration scripts
- `scripts/` — Utility scripts (e.g., codegen, migration helpers)

---

## Getting Started

> **Note:** Using [pnpm](https://pnpm.io/) is recommended on Windows or in monorepo setups, as it avoids deeply nested
`node_modules` trees.  
> Both `npm` and `pnpm` are supported; all workspace scripts work with either.  
> If you use pnpm and commit changes, please commit the `pnpm-lock.yaml` alongside your changes.

1. **Fork the repo and clone your fork**
2. Install all dependencies for all packages:
   ```bash
   npm install
   ```
3. Copy the root `.env.example` to `.env` in the root of the repository:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your credentials. See comments in `.env.example` for details.
4. Start the bot in development from the root:
   ```bash
   npm run start:bot:dev
   ```
   Or, from the bot package:
   ```bash
   cd packages/bot
   npm run start:dev
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

## Code Style

- Use TypeScript for all source files.
- Prefer ES modules (`import/export`).
- Use 4-space indentation.
- Write JSDoc comments for exported functions/classes.
- Lint all packages with:
  ```bash
  npm run lint
  ```
  Or run `npm run lint` in a specific package directory.

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
  npm test
  ```
- Or, run tests in a specific package:
  ```bash
  cd packages/bot
  npm test
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