# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- ISSUES_TODO.md for tracking backlog items
- NEXT_STEPS.md for roadmap and focus areas
- CHANGELOG.md for version history
- DEPLOYMENT.md for deployment guide

### Changed
- Documentation improvements across all MD files

## [1.0.0] - 2025-10-29

### Added
- Monorepo structure with pnpm workspaces
- Express API package (`@zeffuro/fakegaming-bot-api`)
- Discord bot package (`@zeffuro/fakegaming-bot`)
- Common shared package (`@zeffuro/fakegaming-common`)
- Next.js dashboard package (`@zeffuro/fakegaming-bot-dashboard`)

#### Bot Features
- Birthday tracking and announcements with daily job
- Quote management system (add, search, random, list)
- Reminder system with timezone support
- Twitch stream notifications with EventSub
- YouTube video notifications
- TikTok live stream notifications
- League of Legends stats and match history
- Teamfight Tactics stats and match history
- Patch notes fetching and subscriptions (League, Valorant, TFT)
- Weather information
- General utility commands (poll, roll, spin, help)
- Per-guild command and module disabling

#### API Features
- RESTful API with OpenAPI/Swagger documentation
- JWT authentication with HS256
- CSRF protection via double-submit cookie
- DB-backed rate limiting with sliding window
- Discord OAuth integration
- Quote, reminder, birthday, patch notes management endpoints
- Twitch, YouTube, TikTok notification configuration endpoints
- Health and readiness endpoints

#### Dashboard Features
- Discord OAuth login
- Guild management interface
- Quote management per guild
- Twitch stream configuration
- YouTube channel configuration
- TikTok account configuration
- Command and module disabling interface
- Patch note subscriptions management

#### Infrastructure
- PostgreSQL support for production
- SQLite support for development
- Database migrations with Umzug
- Docker Compose deployment setup
- Comprehensive testing with Vitest (80% coverage target)
- ESLint configuration with TypeScript support
- GitHub Actions CI/CD pipeline
- Codecov integration for coverage reporting

#### Security
- CSRF protection on all mutating endpoints
- JWT with required issuer/audience validation
- HttpOnly cookies for dashboard authentication
- Rate limiting to prevent abuse
- Secret scanning via GitHub
- Environment variable hygiene checks

#### Documentation
- Comprehensive README with quick start guide
- ARCHITECTURE.md for code organization patterns
- ENVIRONMENT.md for setup and configuration
- TESTING.md for testing strategy and helpers
- MIGRATIONS.md for database migration guide
- SCHEMA.md with ER diagram and table documentation
- TYPESCRIPT.md for TypeScript conventions
- CONTRIBUTING.md for contribution guidelines
- SECURITY.md for security policy
- CODE_OF_CONDUCT.md for community standards

### Technical Details
- TypeScript with strict mode enabled
- ES modules throughout (`type: "module"`)
- Node.js v22+ required
- Target: ESNext with NodeNext module resolution
- Sequelize ORM with TypeScript decorators
- Vitest for unit and integration testing
- Pino for structured logging
- pg-boss for background jobs (optional, Postgres-only)
- DB-backed cache manager (no Redis dependency)

### Dependencies
- discord.js for Discord bot functionality
- express for API server
- next.js for dashboard
- sequelize for database ORM
- zod for validation
- twurple for Twitch integration
- googleapis for YouTube integration
- axios for HTTP requests
- pino for logging
- vitest for testing

---

## Release Notes Format

Each release should include:

### Added
- New features, commands, or capabilities

### Changed
- Changes to existing functionality
- Documentation updates
- Dependency updates

### Deprecated
- Features marked for removal in future versions

### Removed
- Removed features or breaking changes

### Fixed
- Bug fixes

### Security
- Security-related changes or fixes

---

## How to Release

1. Update version in all `package.json` files
2. Update this CHANGELOG.md with changes since last release
3. Create a git tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
4. Push the tag: `git push origin v1.0.0`
5. GitHub Actions will build and push Docker images (when configured)
6. Create a GitHub release with release notes from CHANGELOG

---

## Links

- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)
- [Repository](https://github.com/Zeffuro/fakegaming-bot)
