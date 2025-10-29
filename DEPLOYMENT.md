# Deployment Guide

This guide covers deploying the fakegaming-bot to production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Deployment](#docker-deployment)
4. [Manual Deployment](#manual-deployment)
5. [Database Setup](#database-setup)
6. [Backup Strategy](#backup-strategy)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Hardware Requirements

**Minimum (2GB VPS):**
- 2GB RAM
- 2 CPU cores
- 20GB storage
- AlmaLinux, Ubuntu, or similar Linux distribution

**Recommended (4GB VPS):**
- 4GB RAM
- 4 CPU cores
- 40GB storage

### Software Requirements

- Docker & Docker Compose (for containerized deployment)
- Node.js v22+ (for manual deployment)
- PostgreSQL 17+ (for production database)
- Git (for cloning the repository)

### External Services

You'll need accounts and API keys for:
- Discord (bot token, application ID, OAuth credentials)
- Twitch (client ID, client secret)
- YouTube (API key)
- OpenWeather (API key)
- Riot Games (League of Legends API key)

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Zeffuro/fakegaming-bot.git
cd fakegaming-bot
```

### 2. Configure Environment Variables

#### Root `.env` (Docker Compose Variables)

```bash
cp .env.example .env
nano .env
```

Set database credentials and volume paths:

```bash
# PostgreSQL configuration
POSTGRES_USER=fakegaming
POSTGRES_PASSWORD=CHANGE_THIS_TO_A_SECURE_PASSWORD
POSTGRES_DB=fakegaming
POSTGRES_PORT=5432

# Docker volume mappings
POSTGRES_DATA_PATH=./data/postgres
BOT_DATA_PATH=./data/bot
```

#### Package `.env` Files (Service Configuration)

For **production**, create `.env` files for each service:

```bash
cp packages/bot/.env.example packages/bot/.env
cp packages/api/.env.example packages/api/.env
cp packages/dashboard/.env.example packages/dashboard/.env
```

Edit each file with your production credentials. See [ENVIRONMENT.md](./ENVIRONMENT.md) for detailed variable descriptions.

**Critical Variables to Set:**

**Bot (`packages/bot/.env`):**
```bash
DATABASE_PROVIDER=postgres
# DATABASE_URL will be injected by Docker Compose

DISCORD_BOT_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_primary_guild_id

API_URL=http://api:3001/api
SERVICE_API_TOKEN=CHANGE_THIS_SHARED_SECRET

RIOT_LEAGUE_API_KEY=your_riot_key
TWITCH_CLIENT_ID=your_twitch_id
TWITCH_CLIENT_SECRET=your_twitch_secret
YOUTUBE_API_KEY=your_youtube_key
OPENWEATHER_API_KEY=your_weather_key

# Optional token encryption
TWITCH_TOKEN_ENC_KEY=CHANGE_THIS_32_CHAR_ENCRYPTION_KEY
```

**API (`packages/api/.env`):**
```bash
PORT=3001
DASHBOARD_URL=https://yourdomain.com
PUBLIC_URL=https://api.yourdomain.com

DATABASE_PROVIDER=postgres
# DATABASE_URL will be injected by Docker Compose

DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=https://yourdomain.com/api/auth/discord/callback

JWT_SECRET=CHANGE_THIS_TO_LONG_RANDOM_STRING
JWT_AUDIENCE=fakegaming-dashboard
JWT_ISSUER=fakegaming

SERVICE_API_TOKEN=CHANGE_THIS_SHARED_SECRET

# Optional: Enable background jobs
JOBS_ENABLED=1
```

**Dashboard (`packages/dashboard/.env`):**
```bash
PORT=3000
PUBLIC_URL=https://yourdomain.com

DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

API_URL=http://api:3001/api

JWT_SECRET=CHANGE_THIS_TO_LONG_RANDOM_STRING
JWT_AUDIENCE=fakegaming-dashboard
JWT_ISSUER=fakegaming

DASHBOARD_ADMINS=123456789012345678,987654321098765432
```

**Important Security Notes:**
- Never commit `.env` files to git (they're in `.gitignore`)
- Use different secrets for development and production
- Rotate secrets periodically (see [ENVIRONMENT.md](./ENVIRONMENT.md) for rotation guide)
- `JWT_SECRET`, `SERVICE_API_TOKEN`, and `TWITCH_TOKEN_ENC_KEY` must be strong random strings

---

## Docker Deployment

### Quick Start (Production)

1. **Ensure environment is configured** (see above)

2. **Start all services:**

```bash
docker-compose up -d
```

This will:
- Pull pre-built images from Docker Hub
- Start PostgreSQL database
- Start the bot, API, and dashboard
- Create necessary volumes for persistent data

3. **Check service status:**

```bash
docker-compose ps
docker-compose logs -f bot
docker-compose logs -f api
docker-compose logs -f dashboard
```

4. **Apply database migrations** (done automatically on startup)

Migrations run automatically when the bot or API starts. Check logs to verify:

```bash
docker-compose logs bot | grep migration
docker-compose logs api | grep migration
```

### Updating Services

To update to the latest version:

```bash
# Pull latest images
docker-compose pull

# Restart services
docker-compose up -d

# Verify update
docker-compose ps
```

### Stopping Services

```bash
# Stop services (keeps data)
docker-compose stop

# Stop and remove containers (keeps data volumes)
docker-compose down

# Stop and remove everything including volumes (DANGER: data loss)
docker-compose down -v
```

---

## Manual Deployment

For deployments without Docker:

### 1. Install Dependencies

```bash
npm install -g pnpm
pnpm install
```

### 2. Build All Packages

```bash
pnpm build
```

### 3. Set Up PostgreSQL

Install and configure PostgreSQL:

```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE fakegaming;
CREATE USER fakegaming WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE fakegaming TO fakegaming;
\q
```

### 4. Configure Environment

Create `.env` files for each package (see Environment Setup above).

Set `DATABASE_URL` in each service:

```bash
DATABASE_URL=postgres://fakegaming:your_password@localhost:5432/fakegaming
```

### 5. Run Services

Use a process manager like PM2:

```bash
npm install -g pm2

# Start bot
pm2 start --name bot "pnpm start:bot" --cwd /path/to/repo

# Start API
pm2 start --name api "pnpm start:api" --cwd /path/to/repo

# Start dashboard
pm2 start --name dashboard "pnpm start:dashboard" --cwd /path/to/repo

# Save PM2 configuration
pm2 save
pm2 startup
```

---

## Database Setup

### Initial Setup

Database migrations run automatically on startup. No manual intervention needed.

To verify migrations:

```bash
# Check SequelizeMeta table
docker-compose exec postgres psql -U fakegaming -d fakegaming -c "SELECT * FROM \"SequelizeMeta\";"
```

### Manual Migration

If you need to run migrations manually:

```bash
# From bot package
cd packages/bot
pnpm start:dev  # Migrations run on startup

# Or from API package
cd packages/api
pnpm start:dev
```

See [MIGRATIONS.md](./MIGRATIONS.md) for detailed migration guide.

---

## Backup Strategy

### PostgreSQL Backup

#### Daily Backups (Recommended)

Create a backup script:

```bash
#!/bin/bash
# /home/user/scripts/backup-db.sh

BACKUP_DIR="/path/to/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/fakegaming_$TIMESTAMP.sql"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Dump database
docker-compose exec -T postgres pg_dump -U fakegaming fakegaming > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Keep only last 7 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

Make it executable and add to cron:

```bash
chmod +x /home/user/scripts/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /home/user/scripts/backup-db.sh
```

#### Restore from Backup

```bash
# Uncompress backup
gunzip fakegaming_20251029_020000.sql.gz

# Restore database
docker-compose exec -T postgres psql -U fakegaming -d fakegaming < fakegaming_20251029_020000.sql
```

### Bot Data Backup

The bot stores assets in `data/bot/`. Back this up regularly:

```bash
# Backup bot data
tar -czf bot_data_$(date +%Y%m%d).tar.gz data/bot/

# Restore bot data
tar -xzf bot_data_20251029.tar.gz
```

---

## Monitoring & Maintenance

### Health Checks

All services expose health endpoints:

**API:**
```bash
curl http://localhost:3001/api/healthz
curl http://localhost:3001/api/ready
```

**Bot:**
```bash
curl http://localhost:8081/healthz
curl http://localhost:8081/ready
```

**Dashboard:**
```bash
curl http://localhost:3000/api/health
```

### Logs

View service logs:

```bash
# Real-time logs
docker-compose logs -f bot
docker-compose logs -f api
docker-compose logs -f dashboard

# Last 100 lines
docker-compose logs --tail=100 bot

# Filter by time
docker-compose logs --since 30m api
```

### Resource Monitoring

Monitor resource usage:

```bash
# Docker stats
docker stats

# Disk usage
df -h

# Check database size
docker-compose exec postgres psql -U fakegaming -d fakegaming -c "SELECT pg_size_pretty(pg_database_size('fakegaming'));"
```

### Memory Management (2GB VPS)

Set conservative memory limits in `docker-compose.yml`:

```yaml
services:
  bot:
    environment:
      NODE_OPTIONS: --max-old-space-size=512
  
  api:
    environment:
      NODE_OPTIONS: --max-old-space-size=512
```

For manual deployment, set in `.env`:

```bash
NODE_OPTIONS=--max-old-space-size=512
```

### Database Maintenance

Periodic maintenance tasks:

```bash
# Vacuum database (weekly)
docker-compose exec postgres psql -U fakegaming -d fakegaming -c "VACUUM ANALYZE;"

# Clean up old cache entries
docker-compose exec postgres psql -U fakegaming -d fakegaming -c "DELETE FROM \"CacheConfigs\" WHERE \"expiresAt\" < NOW();"

# Clean up old rate limit entries
docker-compose exec postgres psql -U fakegaming -d fakegaming -c "DELETE FROM api_rate_limits WHERE window_ts < NOW() - INTERVAL '1 hour';"
```

---

## Troubleshooting

### Services Won't Start

**Check logs:**
```bash
docker-compose logs bot
docker-compose logs api
docker-compose logs dashboard
```

**Common issues:**
- Missing environment variables (check `.env` files)
- Database connection failed (check DATABASE_URL and PostgreSQL status)
- Port conflicts (check if ports 3000, 3001, 5432 are available)

### Database Connection Issues

**Verify PostgreSQL is running:**
```bash
docker-compose ps postgres
```

**Test connection:**
```bash
docker-compose exec postgres psql -U fakegaming -d fakegaming -c "SELECT 1;"
```

**Check DATABASE_URL format:**
```bash
# Correct format
postgres://username:password@host:port/database
```

### Migration Failures

**Check which migrations ran:**
```bash
docker-compose exec postgres psql -U fakegaming -d fakegaming -c "SELECT * FROM \"SequelizeMeta\" ORDER BY name;"
```

**Manually revert a migration:**
See [MIGRATIONS.md](./MIGRATIONS.md) for rollback procedures.

### Bot Not Responding

**Check bot is online:**
- Verify bot shows as online in Discord
- Check `docker-compose logs bot` for errors

**Common issues:**
- Invalid bot token
- Bot not invited to guild
- Missing permissions in guild
- Discord API issues (check Discord status page)

### Dashboard Login Issues

**Check:**
- `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are correct
- `DISCORD_REDIRECT_URI` matches what's configured in Discord Developer Portal
- `JWT_SECRET` matches between API and dashboard
- Cookies are enabled in browser

### High Memory Usage

**On 2GB VPS:**

1. Lower Node.js memory limits:
   ```bash
   NODE_OPTIONS=--max-old-space-size=256
   ```

2. Reduce database connection pool:
   ```javascript
   // In sequelize config
   pool: { max: 5, min: 0 }
   ```

3. Disable optional features:
   ```bash
   JOBS_ENABLED=0
   YOUTUBE_ENRICH_EMBEDS=0
   ```

---

## Security Considerations

### Firewall Configuration

Only expose necessary ports:

```bash
# UFW example
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

**Do not expose:**
- PostgreSQL port (5432)
- Internal service ports (3001, 8081)

### Reverse Proxy (Nginx)

Use Nginx as a reverse proxy for HTTPS:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### SSL Certificates

Use Let's Encrypt for free SSL:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Performance Optimization

### For 2GB VPS

1. **Disable unnecessary features:**
   - YouTube embed enrichment (`YOUTUBE_ENRICH_EMBEDS=0`)
   - Background jobs if not needed (`JOBS_ENABLED=0`)

2. **Tune PostgreSQL** (`postgresql.conf`):
   ```
   shared_buffers = 256MB
   effective_cache_size = 1GB
   maintenance_work_mem = 64MB
   work_mem = 4MB
   ```

3. **Set conservative Node.js limits:**
   - `--max-old-space-size=256` for bot
   - `--max-old-space-size=512` for API/dashboard

4. **Use PM2 cluster mode** for manual deployments:
   ```bash
   pm2 start api -i 2  # 2 instances
   ```

---

## Related Documentation

- [ENVIRONMENT.md](./ENVIRONMENT.md) - Detailed environment variable guide
- [MIGRATIONS.md](./MIGRATIONS.md) - Database migration guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture overview
- [SECURITY.md](./SECURITY.md) - Security policy
- [README.md](./README.md) - Project overview

---

## Support

- Issues: [GitHub Issues](https://github.com/Zeffuro/fakegaming-bot/issues)
- Documentation: See other MD files in repository
- Maintainer: [@Zeffuro](https://github.com/Zeffuro)
