# @zeffuro/fakegaming-bot

Discord bot package for the fakegaming-bot monorepo.

## Overview

The bot package contains Discord.js functionality including slash commands, event handlers, and direct command integrations. Scheduled notification jobs for Twitch, YouTube, TikTok, Bluesky, Steam news, birthdays, reminders, and patch notes run from the API job system and use the shared database models.

## Features

### Commands

The current command catalog is generated from module manifests:

- [Generated command catalog](../../docs/generated/commands.md)
- [Root README command table](../../README.md#available-commands)

### Notification Configuration

- Commands manage notification subscriptions and user settings.
- API jobs perform scheduled delivery and polling when `JOBS_ENABLED=1`.
- Shared models in `@zeffuro/fakegaming-common` keep command and job behavior aligned.

## Architecture

### Module Structure

Commands are organized by feature module. The generated command catalog is the source of truth; this tree is only a short example of the layout:

```
src/modules/
├── general/        # Utility commands (help, roll, poll, weather)
├── quotes/         # Quote management
├── birthdays/      # Birthday tracking
├── reminders/      # Reminder system
├── league/         # League of Legends integration
├── twitch/         # Twitch notifications
├── youtube/        # YouTube notifications
├── tiktok/         # TikTok notifications
└── patchnotes/     # Patch notes system
```

### Services

Direct command helper services in `src/services/`:

- `riotService.ts` - Riot account, League, and TFT API access
- `weatherService.ts` - OpenWeather/Open-Meteo weather lookup and fallback

Scheduled notification delivery lives in `packages/api/src/jobs/`.

## Development

### Setup

```bash
# From repository root
pnpm install

# Build common package first
pnpm --filter @zeffuro/fakegaming-common run build

# Start bot in development mode
pnpm start:bot:dev
```

### Environment Variables

Copy `.env.example` to `.env.development`:

```bash
cp packages/bot/.env.example packages/bot/.env.development
```

Required variables:

```bash
# Discord
DISCORD_BOT_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_test_guild_id

# Database (SQLite for dev)
DATABASE_PROVIDER=sqlite
DATA_ROOT=./data

# API connection
API_URL=http://localhost:3001/api
SERVICE_API_TOKEN=shared_secret_with_api

# External APIs
RIOT_LEAGUE_API_KEY=your_riot_key
TWITCH_CLIENT_ID=your_twitch_id
TWITCH_CLIENT_SECRET=your_twitch_secret
YOUTUBE_API_KEY=your_youtube_key
OPENWEATHER_API_KEY=your_weather_key
```

See [ENVIRONMENT.md](../../ENVIRONMENT.md) for full configuration guide.

### Commands

```bash
# Development mode (auto-reload)
pnpm start:dev

# Production mode
pnpm build
pnpm start

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint
pnpm lint

# Type check
pnpm typecheck
```

### Adding a New Command

1. Create command file in `src/modules/yourmodule/commands/your-command.ts`:

```typescript
import { SlashCommandBuilder } from 'discord.js';
import type { CommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('your-command')
    .setDescription('Your command description');

export async function execute(interaction: CommandInteraction) {
    await interaction.reply('Hello!');
}
```

2. Command will be auto-discovered and registered

3. Rebuild to update manifest:

```bash
pnpm run gen:manifest
pnpm build
```

4. Add tests in `src/modules/yourmodule/commands/__tests__/your-command.test.ts`

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for detailed guide.

## Testing

Tests use Vitest and shared helpers from `@zeffuro/fakegaming-common/testing`.

### Test Structure

```
src/modules/quotes/
├── commands/
│   ├── __tests__/
│   │   └── quote-add.test.ts
│   └── quote-add.ts
```

### Example Test

```typescript
import { describe, it, expect } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';

describe('/quote add', () => {
    it('should add a quote', async () => {
        const { command, interaction, configManager } = await setupCommandTest(
            'modules/quotes/commands/quote-add.js'
        );
        
        await command.execute(interaction);
        
        expect(configManager.quoteManager.add).toHaveBeenCalled();
    });
});
```

See [TESTING.md](../../TESTING.md) for comprehensive testing guide.

## Deployment

### Docker

Using docker-compose (from repository root):

```bash
docker-compose up -d bot
```

### Manual

```bash
# Build
pnpm build

# Start with PM2
pm2 start dist/index.js --name fakegaming-bot

# Or direct
node dist/index.js
```

See [DEPLOYMENT.md](../../DEPLOYMENT.md) for detailed deployment guide.

## Discord Bot Setup

### Create Bot Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give it a name and create
4. Go to "Bot" section
5. Click "Reset Token" and copy the token (this is your `DISCORD_BOT_TOKEN`)
6. Enable required intents:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent (if needed)

### Invite Bot to Server

Use this URL format (replace `CLIENT_ID`):

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot%20applications.commands&permissions=522368
```

**Required Permissions:**
- Send Messages (2048)
- Embed Links (16384)
- Attach Files (32768)
- Read Message History (65536)
- Use External Emojis (262144)
- Add Reactions (64)

## Health Endpoints

The bot exposes internal health endpoints for monitoring:

- `GET /healthz` - Liveness check
- `GET /ready` - Readiness check

**Configuration:**

```bash
BOT_HEALTH_HOST=127.0.0.1  # Bind address (default: loopback only)
BOT_HEALTH_PORT=8081       # Port
```

**Usage:**

```bash
curl http://localhost:8081/healthz
curl http://localhost:8081/ready
```

## Troubleshooting

### Bot won't start

1. Check logs for errors
2. Verify `DISCORD_BOT_TOKEN` is correct
3. Ensure database is accessible
4. Check all required env vars are set

### Commands not appearing

1. Ensure bot has `applications.commands` scope
2. Verify bot is in the server
3. Check command registration in logs
4. Try restarting bot

### Birthday announcements not sending

1. Verify API has `JOBS_ENABLED=1`
2. Check API logs for birthday job
3. Verify channel exists and bot has permissions
4. Check `NotificationConfigs` table for sent notifications

See [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) for more issues and solutions.

## Architecture Patterns

### Command Execution Flow

1. User invokes slash command
2. Discord.js triggers `interactionCreate` event
3. Command loader matches command name
4. Checks `DisabledModuleConfig` and `DisabledCommandConfig`
5. If enabled, executes command's `execute()` function
6. Command interacts with database via managers from `@zeffuro/fakegaming-common`
7. Bot responds to interaction

### Scheduled Job Execution Flow

1. API starts with `JOBS_ENABLED=1`
2. Job bootstrap registers enabled provider jobs
3. Jobs query shared database models and external providers
4. Jobs send Discord notifications through bot credentials or Discord APIs
5. Bot commands update the same subscription/configuration models

## Dependencies

### Core

- `discord.js` - Discord bot library
- `@zeffuro/fakegaming-common` - Shared models, managers, utilities

### External APIs

- `axios` - HTTP client
- `twurple` - Twitch API wrapper
- `googleapis` - YouTube API wrapper

### Development

- `typescript` - Type checking
- `vitest` - Testing framework
- `tsx` - TypeScript execution

## Related Documentation

- [Root README](../../README.md) - Project overview
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - Architecture patterns
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - How to contribute
- [TESTING.md](../../TESTING.md) - Testing guide
- [ENVIRONMENT.md](../../ENVIRONMENT.md) - Environment configuration
- [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) - Common issues

## Support

- Issues: [GitHub Issues](https://github.com/Zeffuro/fakegaming-bot/issues)
- Maintainer: [@Zeffuro](https://github.com/Zeffuro)
