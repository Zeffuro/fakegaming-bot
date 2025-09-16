# fakegaming-bot

A modular Discord bot for community management, Twitch stream notifications, YouTube video announcements, League of
Legends stats, quotes, and reminders. Built with TypeScript and Discord.js.

## Features

- Modular command system
- Twitch and YouTube integration
- League of Legends and Teamfight Tactics stats
- Quote management
- Reminders and timezone support

## Available Commands

_As of September 16th 2025, the following commands are available:_

| Command                | Description                                                       | Permissions |
|------------------------|-------------------------------------------------------------------|-------------|
| `/help`                | List all available commands and their descriptions                | All users   |
| `/league-history`      | Get recent League of Legends match history for a summoner         | All users   |
| `/league-stats`        | Get League of Legends stats for a summoner or linked user         | All users   |
| `/link-riot`           | Link your Discord account or another user to a Riot account       | All users   |
| `/add-quote`           | Add a quote                                                       | All users   |
| `/quotes`              | Get all quotes for a user                                         | All users   |
| `/search-quote`        | Search quotes by text                                             | All users   |
| `/set-reminder`        | Set a reminder                                                    | All users   |
| `/set-timezone`        | Set your timezone                                                 | All users   |
| `/add-twitch-stream`   | Add a Twitch stream for notifications                             | Admin only  |
| `/add-youtube-channel` | Add a YouTube channel for new video notifications                 | Admin only  |
| `/tft-history`         | Get recent Teamfight Tactics match history for a summoner (guild) | All users   |

## Getting Started

### Prerequisites

- Node.js (v22+ recommended)
- npm

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root with:

```
DISCORD_BOT_TOKEN=your_discord_bot_token
DATA_ROOT=optional_path_to_data_directory
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
YOUTUBE_API_KEY=your_youtube_api_key
```

### Running the Bot

```bash
npm start
```

## Running in Docker

You can also run fakegaming-bot in a Docker container.

1. Build the image:
    ```bash
    docker build -t fakegaming-bot .
    ```
2. Run the container (make sure to provide your environment variables, either with a `.env` file or via `-e` flags):
    ```bash
    docker run --env-file .env fakegaming-bot
    ```
    - By default, the bot runs with the command `node dist/index.js`.
    - The working directory inside the container is `/app/code`.

## Project Structure

- `src/index.ts` — Main entry point, bot setup and event handling
- `src/modules/` — Command modules
- `src/services/` — Twitch, YouTube, and reminder services
- `src/config/` — Configuration management

## Contributing

Pull requests and issues are welcome!

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPLv3).  
See [LICENSE](./LICENSE) for details.

Maintained by [@Zeffuro](https://github.com/Zeffuro)