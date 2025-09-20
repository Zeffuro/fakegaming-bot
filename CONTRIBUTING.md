# Contributing to fakegaming-bot

Thanks for your interest in contributing! Please follow these guidelines to get started.

## Getting Started

1. **Fork the repo and clone your fork**
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```
   See the README for details.

4. Start the bot in development using [tsx](https://github.com/esbuild-kit/tsx) (recommended for TypeScript):
   ```bash
   npx tsx src/index.ts
   ```
   If your IDE (e.g. WebStorm) supports run configurations, set it to use the Bundled (tsx) TypeScript loader.

## Code Style

- Use TypeScript for all source files.
- Prefer ES modules (`import/export`).
- Use 4-space indentation.
- Write JSDoc comments for exported functions/classes.

## Adding Commands

- Put new command modules in `src/modules/yourmodule/`.
- Export a `data` object (for Discord command registration) and an `execute` function.
- Register your module in the command loader if needed.

## Adding Preloaders

- Add your asset or service preloader to `src/core/preloadModules.ts`.
- Preloaders should be async functions.

## Branching & Pull Requests

- Create feature branches from `main`.
- Submit PRs with a clear description of your changes.
- Link related issues if applicable.

## Running Tests

Unit tests use [Jest](https://jestjs.io/).

- Run all tests with:
  ```bash
  npm test
  ```

Test files are located in src/modules/*/tests/ and src/services/tests/.

### Writing Tests

- Use `.test.ts` files for unit tests.
- Mock Discord.js interactions and managers as needed (see `MockInteraction` and `setupCommandTest` in
  `src/test/utils/`).
- Prefer testing command logic and service functions in isolation.

### Mocking

- Use `jest.unstable_mockModule` for mocking imports.
- Use `jest.fn()` for mocking functions and methods.

## Spelling Dictionary

To avoid false spelling errors (e.g. `summonerspells`), we use a team-shared dictionary.

- The dictionary is located at `.idea/dictionaries/team.dic`.
- If you add new domain-specific words, add them to this file and commit the change.
- WebStorm will automatically use this dictionary for spellchecking.

If you see spelling warnings for valid project terms, add them to `team.dic` and commit.

## Reporting Issues

- Use [GitHub Issues](https://github.com/Zeffuro/fakegaming-bot/issues) for bugs, features, and questions.

## License

By contributing, you agree that your code will be released under the AGPLv3.

---

Maintained by [@Zeffuro](https://github.com/Zeffuro)