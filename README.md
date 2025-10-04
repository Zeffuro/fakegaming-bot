# fakegaming-bot Monorepo

[![Build Status](https://github.com/Zeffuro/fakegaming-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/Zeffuro/fakegaming-bot/actions)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E=22.0.0-brightgreen)](https://nodejs.org/)
[![ESLint](https://img.shields.io/badge/code_style-eslint-blue.svg)](https://eslint.org/)
[![Vitest](https://img.shields.io/badge/tested_with-vitest-6E9F18.svg?logo=vitest)](https://vitest.dev/)
[![Last Commit](https://img.shields.io/github/last-commit/Zeffuro/fakegaming-bot)](https://github.com/Zeffuro/fakegaming-bot/commits)

A modular Discord bot for community management, Twitch stream notifications, YouTube video announcements, League of
Legends stats, quotes, reminders, and more. Built with TypeScript and Discord.js. **This project is now a monorepo**
containing multiple packages.

---

## Features

- Modular command system
- Twitch and YouTube integration
- League of Legends and Teamfight Tactics stats
- Quote management
- Reminders and timezone support

---

## Monorepo Structure

This repository uses [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) to manage multiple packages:

- **packages/api** — Express REST API for external integrations and bot operations
- **packages/bot** — The Discord bot (commands, services, integrations)
- **packages/common** — Shared code (database models, utilities, types)
- **packages/dashboard** — Dashboard for bot management (Next.js)

- `data/` — Persistent data, assets, and config (used by the bot)
- `migrations/` — Database migration scripts
- `scripts/` — Utility scripts (e.g., codegen, migration helpers)

---

## Getting Started

> **Windows & Monorepo Users:**  
> It’s recommended to use [pnpm](https://pnpm.io/) instead of npm to avoid very deep `node_modules` folders, which can
> cause issues with GitKraken, Windows Explorer, or certain tools.  
> All scripts (`install`, `run build`, `run lint`, `test`, etc.) work with both npm and pnpm.  
> This project includes both `package-lock.json` (npm) and `pnpm-lock.yaml` (pnpm) for reproducible installs. Use the
> package manager of your choice, but if you add new dependencies, please ensure both lockfiles are updated or let us
> know
> which one you used.

### Prerequisites

- Node.js (v22+ recommended)
- npm (v8+)
- (Optional) Docker & Docker Compose for containerized development/production

### Installation

Install all dependencies for all packages:

```bash
npm install
```

### Environment Variables

- Copy the root `.env.example` to `.env` in the root of the repository:
  ```bash
  cp .env.example .env
  ```
- The root `.env` file is used for all services (bot, dashboard, database, etc.).
- Edit the `.env` file and fill in your credentials and configuration. See comments in `.env.example` for details.
- If a package requires additional environment variables, see its README or `.env.example` in its directory (if
  present).

---

## Running & Development

### Running with Docker Compose

You can run the bot and its dependencies using Docker Compose:

```bash
docker-compose up --build
```

- This will start the bot, database, and any other defined services.
- The root `.env` file is used for environment variables.
- Data and database volumes are mapped as defined in `docker-compose.yml` and `.env`.
- To stop and remove containers:
  ```bash
  docker-compose down
  ```
- For production, review and adjust the `docker-compose.yml` and environment variables as needed.

### Running the Bot (Development)

From the repo root:

```bash
npm run start:bot:dev
```

Or, from the bot package:

```bash
cd packages/bot
npm run start:dev
```

### Running the Bot (Production)

From the repo root:

```bash
npm run start:bot
```

Or, from the bot package:

```bash
cd packages/bot
npm start
```

---

## Building, Linting, and Testing

- **Build all packages:**
  ```bash
  npm run build
  ```
- **Lint all packages:**
  ```bash
  npm run lint
  ```
- **Test all packages:**
  ```bash
  npm test
  ```
- You can also run these scripts in each package directory for more granular control.

---

## Database & Migrations

- **Database models** are defined in `packages/common` (typically in `packages/common/src/models/`).
- **Schema changes:** Any change to the database schema (adding/removing fields, tables, etc.) requires a new migration
  script in the `migrations/` directory.
- **Writing migrations:**
    - Create a new migration file in `migrations/` (see existing files for naming conventions, e.g.,
      `YYYYMMDD-description.ts`).
    - Migrations should be written in TypeScript and follow the project's migration conventions.
- **Running migrations:**
    - Use the provided migration scripts or commands (see `scripts/` or package.json scripts) to apply migrations to
      your database.
    - Ensure your database is up to date before running the bot.

---

## Continuous Integration (CI)

This project uses **GitHub Actions** for continuous integration:

- **Builds, lints, and tests** all packages on every pull request and push to `main`.
- **Checks migrations** and code formatting.
- Ensures all code passes before merging.
- See the [CI workflow](https://github.com/Zeffuro/fakegaming-bot/actions) for details.

---

## Available Commands

<!-- COMMAND_TABLE_START -->

| Command | Description | Permissions |
|---------|-------------|-------------|
|`/add-quote`|Add a quote|All users|
|`/add-twitch-stream`|Add a Twitch stream for notifications|All users|
|`/add-youtube-channel`|Add a Youtube Channel for new video notifications|All users|
|`/birthday`|Show your or another user's birthday|All users|
|`/get-patchnotes`|Get the latest patch notes for a game|All users|
|`/help`|List all available commands and their descriptions.|All users|
|`/league-history`|Get recent League of Legends match history for a summoner|All users|
|`/league-stats`|Get League of Legends stats for a summoner or linked user|All users|
|`/link-riot`|Link your Discord account or another user to a Riot account|All users|
|`/poll`|Create a simple poll for users to vote on|All users|
|`/quotes`|Get all quotes for a user|All users|
|`/random-quote`|Get a random quote from the server|All users|
|`/remove-birthday`|Remove your birthday or another user's birthday (admins only)|All users|
|`/roll`|Roll dice or generate a random number|All users|
|`/search-quote`|Search quotes by text|All users|
|`/set-birthday`|Set your birthday and the channel to post in|All users|
|`/set-reminder`|Set a reminder|All users|
|`/set-timezone`|Set your timezone|All users|
|`/spin`|Spin the wheel to pick someone!|All users|
|`/subscribe-patchnotes`|Subscribe a channel to patch notes for a game|All users|
|`/tft-history`|Get recent Teamfight Tactics match history for a summoner|All users|
|`/weather`|Get the current weather and a short forecast for a specified location|All users|
<!-- COMMAND_TABLE_END -->

> **Note:** The command table above is auto-generated by CI. You do not need to update it manually.

---

## Development & Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for code style, how to add commands or preloaders, PR process, and more. Pull
requests and issues are welcome!

---

## Code of Conduct

Participation in this project is governed by our [Code of Conduct](./CODE_OF_CONDUCT.md). Please be respectful and help
us keep the community welcoming.

---

## Security Policy

If you discover a security vulnerability, please see [SECURITY.md](./SECURITY.md) for how to report it privately.

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPLv3).

- **You can use, modify, and share this project, but if you deploy it or make it public, you must also share your
  changes under the same license.**
- See [LICENSE](./LICENSE) for the full text.

---

## FAQ

**Q: Can I use this bot on my own server?**
A: Yes! This project is open source and self-hosted. Follow the instructions above to deploy it to your own environment.

**Q: Is there a public instance or support server?**
A: No, this bot is used privately. There is no public instance or official support server.

**Q: How do I add new commands or features?**
A: See the [CONTRIBUTING.md](./CONTRIBUTING.md) for details on adding commands, features, and database changes.

**Q: Where are the database models?**
A: All models are in `packages/common` (see the Database & Migrations section above).

**Q: How do I report bugs or request features?**
A: Use GitHub Issues. See the Reporting Issues section in [CONTRIBUTING.md](./CONTRIBUTING.md).

**Q: Who maintains this project?**
A: [@Zeffuro](https://github.com/Zeffuro)

---

## Invite the Bot

To invite the bot to your Discord server, use the following links (replace `[client_id]` with your bot's client ID):

- **With Administrator permissions:**  
  `https://discord.com/oauth2/authorize?client_id=[client_id]&scope=bot%20applications.commands&permissions=522368`

- **Without Administrator permissions:**  
  `https://discord.com/oauth2/authorize?client_id=[client_id]&scope=bot%20applications.commands&permissions=522360`

---

Maintained by [@Zeffuro](https://github.com/Zeffuro)