# Environment Variables & Docker Setup

This monorepo uses dedicated Dockerfiles and `.env` files for each service. Docker Compose is configured to load the
correct `.env` file and use the correct Dockerfile for each service automatically.

## Dockerfiles

- **API Service:** `Dockerfile.api`
- **Bot Service:** `Dockerfile.bot`
- **Dashboard Service:** `Dockerfile.dashboard`

## .env File Locations

- **API Service:** `packages/api/.env`
- **Bot Service:** `packages/bot/.env`
- **Dashboard Service:** `packages/dashboard/.env`

## Key Environment Variables

- **PORT:** The port each service listens on (e.g., `PORT=3001` for API, `PORT=3000` for dashboard)
- **PUBLIC_URL:** The public URL for each service (e.g., `PUBLIC_URL=http://localhost:3001/api` for API)

## Volume Mappings

- **API Data:** `${API_DATA_PATH}` (see `.env.example`)
- **API Code:** `${API_CODE_PATH}`
- **Bot Data:** `${BOT_DATA_PATH}`
- **Bot Code:** `${BOT_CODE_PATH}`
- **Dashboard Code:** `${DASHBOARD_CODE_PATH}`
- **Postgres Data:** `${POSTGRES_DATA_PATH}`

## Docker Compose Integration

Each service in `docker-compose.yml` uses its own Dockerfile and `.env` file, and passes `PORT` and `PUBLIC_URL` to the
container environment:

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    env_file:
      - ./packages/api/.env
    environment:
      PORT: ${PORT}
      PUBLIC_URL: ${PUBLIC_URL}
      # ...other variables...

  dashboard:
    build:
      context: .
      dockerfile: Dockerfile.dashboard
    env_file:
      - ./packages/dashboard/.env
    environment:
      PORT: ${PORT}
      PUBLIC_URL: ${PUBLIC_URL}
      # ...other variables...
```

## Setup Instructions

1. Copy the `.env.example` file in each package to `.env`:
    - `cp packages/api/.env.example packages/api/.env`
    - `cp packages/bot/.env.example packages/bot/.env`
    - `cp packages/dashboard/.env.example packages/dashboard/.env`
2. Fill in the required values in each `.env` file, including `PORT` and `PUBLIC_URL`.
3. Run `docker-compose up` to start the services. Each service will use its own Dockerfile and environment variables.

## Local Development vs Docker Compose

- For local development, set `DATABASE_URL` and other connection strings in each service’s `.env` file.
- When running with Docker Compose, these variables are set automatically from the root `.env` file and will override
  local values in the container.
- To set up your environment for local development:
    1. Copy `.env.example` to `.env` in each package:
        - `cp packages/api/.env.example packages/api/.env`
        - `cp packages/bot/.env.example packages/bot/.env`
        - `cp packages/dashboard/.env.example packages/dashboard/.env`
    2. Fill in the required values, including `DATABASE_URL` for local use.
    3. For Docker Compose, you do not need to set `DATABASE_URL` in service `.env` files; it is set automatically.

## Notes

- Do **not** commit your `.env` files to git. They are ignored by `.gitignore`.
- If you add a new service, create a corresponding Dockerfile and `.env` file, and update `docker-compose.yml`.
- For secrets and host-specific paths, use the `.env` files and never hardcode them in source code.
