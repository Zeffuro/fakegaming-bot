# Troubleshooting Guide

Common issues and solutions for fakegaming-bot.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Build & Compilation Issues](#build--compilation-issues)
3. [Runtime Issues](#runtime-issues)
4. [Database Issues](#database-issues)
5. [Bot Issues](#bot-issues)
6. [Dashboard Issues](#dashboard-issues)
7. [API Issues](#api-issues)
8. [Docker Issues](#docker-issues)
9. [Testing Issues](#testing-issues)

---

## Installation Issues

### pnpm not found

**Error:**
```bash
pnpm: command not found
```

**Solution:**
```bash
npm install -g pnpm
```

### Package installation fails

**Error:**
```bash
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL
```

**Solution:**

1. Clear pnpm cache:
   ```bash
   pnpm store prune
   ```

2. Delete node_modules and reinstall:
   ```bash
   rm -rf node_modules packages/*/node_modules
   pnpm install
   ```

3. Check Node.js version (need v22+):
   ```bash
   node --version
   ```

---

## Build & Compilation Issues

### Cannot find module '@zeffuro/fakegaming-common'

**Error:**
```
Error: Cannot find module '@zeffuro/fakegaming-common'
```

**Solution:**

Build the common package first:
```bash
pnpm --filter @zeffuro/fakegaming-common run build
pnpm install
```

### TypeScript compilation errors

**Error:**
```
error TS2307: Cannot find module './module.js'
```

**Solution:**

This is expected behavior. TypeScript resolves `.ts` files but requires `.js` extensions in imports for ES modules. The code will compile and run correctly.

### Generated manifest not found

**Error:**
```
Cannot find module 'bot-manifest.ts'
```

**Solution:**

Generate the bot manifest:
```bash
pnpm run gen:manifest
```

### Dashboard build fails with JWT_SECRET missing

**Error:**
```
Error: [env] Missing required environment variable: JWT_SECRET
```

**Solution:**

Create `.env` files for each package:
```bash
cp packages/dashboard/.env.example packages/dashboard/.env
# Edit and add JWT_SECRET, JWT_AUDIENCE, JWT_ISSUER
```

---

## Runtime Issues

### Module not found errors at runtime

**Error:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
```

**Solutions:**

1. **Rebuild all packages:**
   ```bash
   pnpm build
   ```

2. **Check import extensions:**
   - Imports must use `.js` extension even for `.ts` files
   - Example: `import { x } from './module.js'` ✅
   - Not: `import { x } from './module'` ❌

3. **Verify package.json has `"type": "module"`**

### Environment variables not loading

**Error:**
```
Missing required environment variable
```

**Solutions:**

1. **Check file exists:**
   ```bash
   ls -la packages/bot/.env
   ls -la packages/api/.env
   ls -la packages/dashboard/.env
   ```

2. **Check file names:**
   - Development: `.env.development`
   - Production: `.env`

3. **Verify NODE_ENV:**
   ```bash
   echo $NODE_ENV
   ```

4. **Check for quotes in .env:**
   ```bash
   # ❌ Wrong (quoted)
   JWT_SECRET="my-secret"
   
   # ✅ Correct (unquoted)
   JWT_SECRET=my-secret
   ```

---

## Database Issues

### Cannot connect to database

**Error:**
```
ConnectionRefusedError: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions:**

**For PostgreSQL:**

1. Check PostgreSQL is running:
   ```bash
   # Linux
   sudo systemctl status postgresql
   
   # Docker
   docker-compose ps postgres
   ```

2. Verify DATABASE_URL format:
   ```bash
   DATABASE_URL=postgres://user:password@host:5432/database
   ```

3. Test connection:
   ```bash
   psql -h localhost -U fakegaming -d fakegaming
   ```

**For SQLite (dev):**

1. Ensure directory exists:
   ```bash
   mkdir -p data/bot
   ```

2. Check DATABASE_PROVIDER:
   ```bash
   DATABASE_PROVIDER=sqlite
   ```

### Migration fails

**Error:**
```
Migration failed: relation "TableName" already exists
```

**Solutions:**

1. **Check applied migrations:**
   ```sql
   SELECT * FROM "SequelizeMeta" ORDER BY name;
   ```

2. **Manually mark migration as applied:**
   ```sql
   INSERT INTO "SequelizeMeta" (name) VALUES ('20251029-migration-name.ts');
   ```

3. **Rollback and retry:**
   - See [MIGRATIONS.md](./MIGRATIONS.md) for rollback procedures

### Database locked (SQLite)

**Error:**
```
SQLITE_BUSY: database is locked
```

**Solution:**

1. Stop all services accessing the database
2. Remove lock file:
   ```bash
   rm data/bot/dev.sqlite-shm
   rm data/bot/dev.sqlite-wal
   ```
3. Restart services

---

## Bot Issues

### Bot not going online

**Checklist:**

1. **Verify bot token:**
   ```bash
   echo $DISCORD_BOT_TOKEN
   ```

2. **Check bot has correct intents:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Select your application
   - Enable required intents under "Bot" section:
     - Presence Intent
     - Server Members Intent
     - Message Content Intent (if needed)

3. **Check bot logs:**
   ```bash
   docker-compose logs bot
   # or
   pnpm start:bot:dev
   ```

4. **Verify bot is invited to guild:**
   - Bot must be in at least one server
   - Use invite link with correct permissions

### Commands not registering

**Solutions:**

1. **Regenerate manifest:**
   ```bash
   pnpm run gen:manifest
   pnpm build
   ```

2. **Restart bot:**
   ```bash
   docker-compose restart bot
   ```

3. **Check command registration in logs:**
   - Look for "Registered X commands" message

4. **Force re-register commands:**
   - Delete `.env` temporarily to force re-registration
   - Restart bot
   - Restore `.env`

### Command execution fails

**Error:**
```
This interaction failed
```

**Solutions:**

1. **Check bot logs** for errors:
   ```bash
   docker-compose logs bot | grep -i error
   ```

2. **Verify bot permissions** in guild:
   - Send Messages
   - Embed Links
   - Attach Files
   - Use External Emojis
   - Read Message History

3. **Check DisabledCommands config:**
   ```sql
   SELECT * FROM "DisabledCommandConfigs" WHERE "guildId" = 'YOUR_GUILD_ID';
   ```

4. **Check DisabledModules config:**
   ```sql
   SELECT * FROM "DisabledModuleConfigs" WHERE "guildId" = 'YOUR_GUILD_ID';
   ```

### Birthday announcements not sending

**Checklist:**

1. **Verify birthday is configured:**
   ```sql
   SELECT * FROM "BirthdayConfigs" WHERE "userId" = 'USER_ID';
   ```

2. **Check notification sent:**
   ```sql
   SELECT * FROM "NotificationConfigs" 
   WHERE "key" LIKE 'birthday:%'
   ORDER BY "createdAt" DESC LIMIT 10;
   ```

3. **Check job is running:**
   - API must have `JOBS_ENABLED=1`
   - Check API logs for birthday job execution

4. **Verify channel exists and bot has permissions**

### Twitch notifications not working

**Checklist:**

1. **Verify EventSub subscription:**
   - Check Twitch Developer Console
   - Verify webhook is registered

2. **Check TwitchStreamConfig:**
   ```sql
   SELECT * FROM "TwitchStreamConfigs";
   ```

3. **Verify Twitch credentials:**
   ```bash
   echo $TWITCH_CLIENT_ID
   echo $TWITCH_CLIENT_SECRET
   ```

4. **Check cooldown:**
   - Notifications respect cooldown period
   - Check `lastNotifiedAt` timestamp

5. **Check quiet hours:**
   - Verify current time is not in quiet hours range

---

## Dashboard Issues

### Cannot log in

**Checklist:**

1. **Verify Discord OAuth configuration:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Check OAuth2 Redirect URI matches `PUBLIC_URL/api/auth/discord/callback`

2. **Check environment variables:**
   ```bash
   DISCORD_CLIENT_ID=...
   DISCORD_CLIENT_SECRET=...
   JWT_SECRET=... (must match API)
   ```

3. **Check cookies are enabled** in browser

4. **Clear browser cookies** and try again

5. **Check dashboard logs:**
   ```bash
   docker-compose logs dashboard
   ```

### 403 Forbidden on guild pages

**Causes:**

1. **User is not in the guild**
2. **User doesn't have administrator permissions**
3. **Cache hasn't updated**

**Solutions:**

1. **Verify user is guild admin:**
   - Check in Discord server settings

2. **Clear guild cache:**
   ```sql
   DELETE FROM "CacheConfigs" WHERE "key" LIKE 'user:%:guilds';
   ```

3. **Logout and login again**

### Dashboard shows blank page

**Solutions:**

1. **Check browser console** for JavaScript errors:
   - Press F12 → Console tab

2. **Verify API is reachable:**
   ```bash
   curl http://localhost:3001/api/healthz
   ```

3. **Check dashboard build:**
   ```bash
   cd packages/dashboard
   pnpm build
   ```

4. **Clear Next.js cache:**
   ```bash
   rm -rf packages/dashboard/.next
   pnpm build
   ```

---

## API Issues

### 401 Unauthorized

**Causes:**

1. Missing or invalid JWT token
2. Token expired
3. JWT_SECRET mismatch

**Solutions:**

1. **Check token is being sent:**
   ```bash
   curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/quotes
   ```

2. **Verify JWT_SECRET matches** between API and dashboard

3. **Check token expiration:**
   - Tokens expire after 24 hours (default)
   - Login again to get new token

### 403 CSRF token missing

**Causes:**

1. CSRF token not sent in header
2. CSRF cookie not sent
3. Token mismatch

**Solutions:**

1. **Verify cookie is sent:**
   ```javascript
   credentials: 'include'
   ```

2. **Send CSRF header:**
   ```javascript
   headers: {
     'x-csrf-token': csrfToken
   }
   ```

3. **Get fresh CSRF token** after login

### 429 Too Many Requests

**Cause:** Rate limit exceeded

**Solution:**

1. **Wait for rate limit to reset:**
   - Check `Retry-After` header for seconds to wait

2. **Check `X-RateLimit-Reset`** for exact reset time

3. **Reduce request frequency** in your application

### 500 Internal Server Error

**Solutions:**

1. **Check API logs:**
   ```bash
   docker-compose logs api
   ```

2. **Check database connection:**
   ```bash
   curl http://localhost:3001/api/ready
   ```

3. **Verify all environment variables are set**

4. **Check for database migration issues:**
   ```sql
   SELECT * FROM "SequelizeMeta";
   ```

---

## Docker Issues

### Container won't start

**Solutions:**

1. **Check logs:**
   ```bash
   docker-compose logs service-name
   ```

2. **Verify environment files exist:**
   ```bash
   ls -la packages/*/env
   ```

3. **Check port conflicts:**
   ```bash
   # Check if port is already in use
   sudo netstat -tulpn | grep :3000
   ```

4. **Rebuild containers:**
   ```bash
   docker-compose down
   docker-compose up --build -d
   ```

### Cannot connect between containers

**Solutions:**

1. **Use service names** as hostnames:
   - ✅ `http://api:3001`
   - ❌ `http://localhost:3001`

2. **Verify services are on same network:**
   ```bash
   docker network inspect fakegaming-bot_default
   ```

3. **Check docker-compose.yml** for network configuration

### Volume permission issues

**Error:**
```
EACCES: permission denied
```

**Solutions:**

1. **Fix volume permissions:**
   ```bash
   sudo chown -R 1000:1000 data/
   ```

2. **Run with correct user** in docker-compose.yml:
   ```yaml
   user: "1000:1000"
   ```

---

## Testing Issues

### Tests fail to run

**Solutions:**

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Build common package:**
   ```bash
   pnpm --filter @zeffuro/fakegaming-common run build
   ```

3. **Check vitest is installed:**
   ```bash
   pnpm list vitest
   ```

### Mock not working

**Solution:**

In ESM, mocks must be defined **before** imports:

```typescript
// ✅ Correct
vi.mock('./module.js', () => ({ ... }));
import { myFunction } from './module.js';

// ❌ Wrong
import { myFunction } from './module.js';
vi.mock('./module.js', () => ({ ... }));
```

See [TESTING.md](./TESTING.md) for detailed testing guide.

### Coverage not meeting threshold

**Solutions:**

1. **Add tests for uncovered code**

2. **Check excluded files** in vitest.config.ts

3. **Run coverage report:**
   ```bash
   pnpm test:coverage
   ```

4. **View HTML coverage report:**
   ```bash
   open coverage/index.html
   ```

---

## Getting Help

### Log Analysis

Always check logs first:

```bash
# Docker
docker-compose logs bot
docker-compose logs api
docker-compose logs dashboard

# Manual deployment
pm2 logs bot
pm2 logs api
pm2 logs dashboard
```

### Verbose Logging

Enable debug logging:

```bash
LOG_LEVEL=debug
LOG_PRETTY=1  # For development only
```

### Health Checks

Verify services are healthy:

```bash
curl http://localhost:3001/api/healthz
curl http://localhost:3001/api/ready
curl http://localhost:8081/healthz  # Bot health
```

### Database Inspection

Check database state:

```bash
# Connect to database
docker-compose exec postgres psql -U fakegaming -d fakegaming

# List tables
\dt

# Inspect table
SELECT * FROM "TableName" LIMIT 10;
```

---

## Still Having Issues?

1. **Search existing issues:** [GitHub Issues](https://github.com/Zeffuro/fakegaming-bot/issues)

2. **Check documentation:**
   - [README.md](./README.md)
   - [ENVIRONMENT.md](./ENVIRONMENT.md)
   - [ARCHITECTURE.md](./ARCHITECTURE.md)
   - [DEPLOYMENT.md](./DEPLOYMENT.md)

3. **Create new issue** with:
   - Description of the problem
   - Steps to reproduce
   - Relevant logs
   - Environment details (OS, Node version, Docker version)

---

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
- [ENVIRONMENT.md](./ENVIRONMENT.md) - Environment configuration
- [TESTING.md](./TESTING.md) - Testing guide
- [MIGRATIONS.md](./MIGRATIONS.md) - Database migrations
