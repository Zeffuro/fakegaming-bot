# API Guide

Complete guide to using the fakegaming-bot REST API.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Endpoints](#endpoints)
6. [Examples](#examples)
7. [OpenAPI Specification](#openapi-specification)

---

## Overview

The fakegaming-bot API is a RESTful API built with Express.js that provides programmatic access to bot features and configuration.

**Base URL:**
- Production: `https://api.yourdomain.com/api`
- Local Development: `http://localhost:3001/api`

**API Version:** 1.0.0

**Content Type:** `application/json`

---

## Authentication

The API supports two authentication methods:

### 1. JWT Token (External Clients & Dashboard)

Used by the dashboard and external clients.

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Getting a Token:**

Tokens are issued after Discord OAuth login. See the dashboard implementation for reference.

**Token Format:**
```json
{
  "sub": "discord_user_id",
  "aud": "fakegaming-dashboard",
  "iss": "fakegaming",
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Token Expiration:** 24 hours (configurable)

### 2. Service Token (Bot -> API)

Used for service-to-service communication from the bot.

**Headers:**
```http
X-Service-Token: <service_token>
```

**Configuration:**

Set `SERVICE_API_TOKEN` in both bot and API `.env` files to the same value.

---

## Error Handling

### Standard Error Format

All errors follow a consistent format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": { }
}
```

### HTTP Status Codes

| Status | Meaning | Description |
|--------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters or body |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |

### Common Error Codes

- `VALIDATION_ERROR` - Request validation failed
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource already exists
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `CSRF` - CSRF token missing or invalid
- `INTERNAL_ERROR` - Server error

---

## Rate Limiting

The API enforces rate limiting using a database-backed sliding window algorithm.

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698765432000
```

On rate limit exceeded (429):

```http
Retry-After: 60
```

### Default Limits

| Endpoint Type | Requests | Window |
|---------------|----------|--------|
| General | 100 | 15 minutes |
| Authentication | 10 | 15 minutes |

**Note:** Limits are per IP address.

---

## Endpoints

### Health & Status

#### GET /api/healthz

**Description:** Health check endpoint (liveness probe)

**Authentication:** None

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1698765432000
}
```

#### GET /api/ready

**Description:** Readiness check endpoint

**Authentication:** None

**Response:**
```json
{
  "status": "ready",
  "database": "connected",
  "timestamp": 1698765432000
}
```

---

### Authentication

#### POST /api/auth/login

**Description:** Initiate Discord OAuth flow

**Authentication:** None

**Body:**
```json
{
  "redirectUri": "https://yourdomain.com/api/auth/discord/callback"
}
```

**Response:**
```json
{
  "url": "https://discord.com/oauth2/authorize?..."
}
```

---

### Quotes

#### GET /api/quotes

**Description:** List quotes for a guild

**Authentication:** JWT or Service Token

**Query Parameters:**
- `guildId` (required): Discord guild ID
- `authorId` (optional): Filter by author Discord ID
- `search` (optional): Search in quote text
- `limit` (optional): Results per page (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "quotes": [
    {
      "id": "uuid",
      "guildId": "123456789",
      "quote": "This is a quote",
      "authorId": "987654321",
      "submitterId": "111222333",
      "timestamp": 1698765432000,
      "createdAt": "2024-10-29T12:00:00Z",
      "updatedAt": "2024-10-29T12:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

#### POST /api/quotes

**Description:** Add a new quote

**Authentication:** JWT or Service Token

**CSRF:** Required for JWT auth

**Body:**
```json
{
  "guildId": "123456789",
  "quote": "This is a quote",
  "authorId": "987654321",
  "submitterId": "111222333"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "guildId": "123456789",
  "quote": "This is a quote",
  "authorId": "987654321",
  "submitterId": "111222333",
  "timestamp": 1698765432000
}
```

#### GET /api/quotes/:id

**Description:** Get a specific quote

**Authentication:** JWT or Service Token

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "guildId": "123456789",
  "quote": "This is a quote",
  "authorId": "987654321",
  "submitterId": "111222333",
  "timestamp": 1698765432000
}
```

#### DELETE /api/quotes/:id

**Description:** Delete a quote

**Authentication:** JWT or Service Token

**CSRF:** Required for JWT auth

**Response:** `200 OK`
```json
{
  "message": "Quote deleted successfully"
}
```

---

### Birthdays

#### GET /api/birthdays

**Description:** List birthdays for a guild

**Authentication:** JWT or Service Token

**Query Parameters:**
- `guildId` (required): Discord guild ID

**Response:**
```json
{
  "birthdays": [
    {
      "userId": "123456789",
      "day": 15,
      "month": 10,
      "year": 1990,
      "guildId": "987654321",
      "channelId": "111222333"
    }
  ]
}
```

#### POST /api/birthdays

**Description:** Set a birthday

**Authentication:** JWT or Service Token

**CSRF:** Required for JWT auth

**Body:**
```json
{
  "userId": "123456789",
  "day": 15,
  "month": 10,
  "year": 1990,
  "guildId": "987654321",
  "channelId": "111222333"
}
```

**Response:** `201 Created`
```json
{
  "userId": "123456789",
  "day": 15,
  "month": 10,
  "year": 1990,
  "guildId": "987654321",
  "channelId": "111222333"
}
```

#### DELETE /api/birthdays/:userId

**Description:** Remove a birthday

**Authentication:** JWT or Service Token

**CSRF:** Required for JWT auth

**Response:** `200 OK`
```json
{
  "message": "Birthday removed successfully"
}
```

---

### Twitch

#### GET /api/twitch/streams

**Description:** List Twitch stream configurations

**Authentication:** JWT or Service Token

**Query Parameters:**
- `guildId` (required): Discord guild ID

**Response:**
```json
{
  "streams": [
    {
      "id": 1,
      "twitchUsername": "streamername",
      "discordChannelId": "123456789",
      "customMessage": "Check out the stream!",
      "cooldownMinutes": 30,
      "quietHoursStart": "22:00",
      "quietHoursEnd": "08:00",
      "lastNotifiedAt": "2024-10-29T12:00:00Z",
      "guildId": "987654321"
    }
  ]
}
```

#### POST /api/twitch/streams

**Description:** Add Twitch stream notification

**Authentication:** JWT or Service Token

**CSRF:** Required for JWT auth

**Body:**
```json
{
  "twitchUsername": "streamername",
  "discordChannelId": "123456789",
  "guildId": "987654321",
  "customMessage": "Optional custom message",
  "cooldownMinutes": 30,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00"
}
```

**Response:** `201 Created`

#### DELETE /api/twitch/streams/:id

**Description:** Remove Twitch stream notification

**Authentication:** JWT or Service Token

**CSRF:** Required for JWT auth

**Response:** `200 OK`

---

### YouTube

#### GET /api/youtube/channels

**Description:** List YouTube channel configurations

**Authentication:** JWT or Service Token

**Query Parameters:**
- `guildId` (required): Discord guild ID

**Response:**
```json
{
  "channels": [
    {
      "id": 1,
      "youtubeChannelId": "UC...",
      "discordChannelId": "123456789",
      "lastVideoId": "abc123",
      "customMessage": "New video!",
      "cooldownMinutes": 60,
      "quietHoursStart": "22:00",
      "quietHoursEnd": "08:00",
      "lastNotifiedAt": "2024-10-29T12:00:00Z",
      "guildId": "987654321"
    }
  ]
}
```

#### POST /api/youtube/channels

**Description:** Add YouTube channel notification

**Authentication:** JWT or Service Token

**CSRF:** Required for JWT auth

**Body:**
```json
{
  "youtubeChannelId": "UC...",
  "discordChannelId": "123456789",
  "guildId": "987654321",
  "customMessage": "Optional",
  "cooldownMinutes": 60
}
```

**Response:** `201 Created`

#### DELETE /api/youtube/channels/:id

**Description:** Remove YouTube channel notification

**Authentication:** JWT or Service Token

**CSRF:** Required for JWT auth

**Response:** `200 OK`

---

### Disabled Commands

#### GET /api/disabled-commands

**Description:** List disabled commands for a guild

**Authentication:** JWT or Service Token

**Query Parameters:**
- `guildId` (required): Discord guild ID

**Response:**
```json
{
  "disabledCommands": [
    {
      "id": 1,
      "guildId": "123456789",
      "commandName": "/poll"
    }
  ]
}
```

#### POST /api/disabled-commands

**Description:** Disable a command

**Authentication:** JWT or Service Token

**CSRF:** Required for JWT auth

**Body:**
```json
{
  "guildId": "123456789",
  "commandName": "/poll"
}
```

**Response:** `201 Created`

#### DELETE /api/disabled-commands/:id

**Description:** Enable a command

**Authentication:** JWT or Service Token

**CSRF:** Required for JWT auth

**Response:** `200 OK`

---

## Examples

### Using curl

#### Get Quotes (with JWT)

```bash
curl -X GET "http://localhost:3001/api/quotes?guildId=123456789" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json"
```

#### Add Quote (with CSRF)

```bash
curl -X POST "http://localhost:3001/api/quotes" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: abc123..." \
  -H "Cookie: csrf=abc123..." \
  -d '{
    "guildId": "123456789",
    "quote": "This is a quote",
    "authorId": "987654321",
    "submitterId": "111222333"
  }'
```

### Using JavaScript (fetch)

```javascript
// Get quotes
const response = await fetch('http://localhost:3001/api/quotes?guildId=123456789', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  }
});
const data = await response.json();

// Add quote
const response = await fetch('http://localhost:3001/api/quotes', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken
  },
  credentials: 'include', // Send cookies
  body: JSON.stringify({
    guildId: '123456789',
    quote: 'This is a quote',
    authorId: '987654321',
    submitterId: '111222333'
  })
});
```

### Using TypeScript (with generated types)

```typescript
import type { paths } from '@zeffuro/fakegaming-common/types/api';

type QuotesGetResponse = paths['/quotes']['get']['responses']['200']['content']['application/json'];
type QuotesPostRequest = paths['/quotes']['post']['requestBody']['content']['application/json'];

async function getQuotes(guildId: string): Promise<QuotesGetResponse> {
  const response = await fetch(`/api/quotes?guildId=${guildId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    }
  });
  return response.json();
}
```

---

## OpenAPI Specification

The API includes a complete OpenAPI 3.0 specification.

**Access:**
- Swagger UI: `http://localhost:3001/api-docs`
- JSON spec: `http://localhost:3001/api/openapi.json`
- Local file: `packages/api/openapi.json`

**Generate TypeScript Types:**

```bash
pnpm run gen:api-types
```

This generates type definitions in `packages/common/types/api.d.ts`.

---

## CSRF Protection

All mutating endpoints (POST, PUT, PATCH, DELETE) require CSRF protection when using JWT authentication.

**How it Works:**

1. Client receives CSRF token in `csrf` cookie (SameSite=Lax)
2. Client sends token in `x-csrf-token` header
3. API validates header matches cookie

**Example:**

```javascript
// Get CSRF token from cookie
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf='))
  ?.split('=')[1];

// Send with mutating request
fetch('/api/quotes', {
  method: 'POST',
  headers: {
    'x-csrf-token': csrfToken,
    'Authorization': `Bearer ${jwt}`,
  },
  credentials: 'include',
  body: JSON.stringify(data)
});
```

**Token Rotation:**

CSRF tokens are rotated:
- On login
- On JWT refresh
- Periodically (implementation-specific)

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Service boundaries and patterns
- [ENVIRONMENT.md](./ENVIRONMENT.md) - API configuration
- [SECURITY.md](./SECURITY.md) - Security policies
- [packages/api/README.md](./packages/api/README.md) - API package details

---

## Support

- Issues: [GitHub Issues](https://github.com/Zeffuro/fakegaming-bot/issues)
- API Spec: See Swagger UI at `/api-docs`
