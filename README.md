# fakegaming-bot

[![Build Status](https://github.com/Zeffuro/fakegaming-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/Zeffuro/fakegaming-bot/actions)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E=22.0.0-brightgreen)](https://nodejs.org/)
[![ESLint](https://img.shields.io/badge/code_style-eslint-blue.svg)](https://eslint.org/)
[![Jest](https://img.shields.io/badge/tested_with-jest-99424f.svg?logo=jest)](https://jestjs.io/)
[![Last Commit](https://img.shields.io/github/last-commit/Zeffuro/fakegaming-bot)](https://github.com/Zeffuro/fakegaming-bot/commits)

A modular Discord bot for community management, Twitch stream notifications, YouTube video announcements, League of
Legends stats, quotes, and reminders. Built with TypeScript and Discord.js.

---

## Features

- Modular command system
- Twitch and YouTube integration
- League of Legends and Teamfight Tactics stats
- Quote management
- Reminders and timezone support

---

## Available Commands

<!-- COMMAND_TABLE_START -->
| Command | Description | Permissions |
|---------|-------------|-------------|
<!-- COMMAND_TABLE_END -->
---

## Getting Started

### Prerequisites

- Node.js (v22+ recommended)
- npm

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root with the following keys (see `.env.example` for all options):

```
DISCORD_BOT_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
GUILD_ID=your_discord_guild_id
RIOT_LEAGUE_API_KEY=your_riot_league_api_key
RIOT_TFT_API_KEY=your_riot_tft_api_key
RIOT_DEV_API_KEY=your_riot_dev_api_key
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
YOUTUBE_API_KEY=your_youtube_api_key
DATA_ROOT=optional_path_to_data_directory
```

---

### Running the Bot

Recommended for development:

```bash
npx tsx src/index.ts
```

Or, in production:

```bash
npm start
```

You can also use IDE run configurations (e.g. JetBrains/WebStorm with Bundled (tsx) TypeScript loader).

---

## Asset Preloading & Caching

League of Legends and Teamfight Tactics assets are downloaded and cached in memory at bot startup for fast command
response.  
See [`src/core/preloadModules.ts`](src/core/preloadModules.ts) for details. You can add new preloaders for other games
or services by updating this file.

---

## Running in Docker

You can also run fakegaming-bot in a Docker container.

1. Build the image:
    ```bash
    docker build -t fakegaming-bot .
    ```
2. Run the container (provide your environment variables with a `.env` file or `-e` flags):
    ```bash
    docker run --env-file .env fakegaming-bot
    ```
    - By default, the bot runs with the command `node dist/index.js`.
    - The working directory inside the container is `/app/code`.

### Persisting Data with Docker Volumes

To keep your bot's data outside the container, map a host directory to `/app/data` (or your custom path set by
`DATA_ROOT`):

```bash
  docker run --env-file .env -v /path/on/host:/app/data fakegaming-bot
```

- /app/data is the default data directory inside the container.
- You can change this by setting the DATA_ROOT environment variable in your .env file.

---

## Project Structure

- `src/index.ts` — Main entry point, bot setup and event handling
- `src/core/` — Environment bootstrap, command loading, and module preloaders
- `src/modules/` — Command modules (each feature in its own folder)
- `src/services/` — Twitch, YouTube, reminders, and other background services
- `src/config/` — Configuration and manager classes for bot features
- `src/constants/` — Shared constants and enums
- `src/types/` — Custom TypeScript types and interfaces
- `src/utils/` — Utility functions (general helpers, time, permissions, etc.)
- `src/test/` — Shared test utilities, mocks, and factories

---

## Development & Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for code style, how to add commands or preloaders, PR process, and more.

Pull requests and issues are welcome!

### Running Tests

Unit tests use [Jest](https://jestjs.io/).

To run all tests, use `npm test`.

Test files are in `src/modules/*/tests/` and `src/services/tests/`.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for more details.

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPLv3).
See [LICENSE](./LICENSE) for details.

Maintained by [@Zeffuro](https://github.com/Zeffuro)