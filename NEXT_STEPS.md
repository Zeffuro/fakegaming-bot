# NEXT STEPS — Lean Roadmap (as of 2025-10-29)

## Goal
Ship small, high-impact features that fit a single 2GB AlmaLinux VPS with Docker. Prefer DB-backed solutions, avoid adding services.

---

## What Exists Now (Quick Reality Check)

- ✅ **Birthdays end-to-end:** model/manager/API routes and a daily job at 09:00 using Notifications for idempotency.
- ✅ **Jobs infra:** API worker with Postgres-backed adapter (pg-boss) and memory fallback behind `JOBS_ENABLED`.
- ✅ **Twitch/YouTube/TikTok jobs** and rate limiting present.
- ✅ **Dashboard** is JWT/CSRF-hardened with Discord OAuth.
- ✅ **Comprehensive testing** infrastructure with Vitest and shared test helpers.
- ✅ **Documentation** covering architecture, environment, migrations, schema, testing, TypeScript conventions.

---

## Focus for the Next 2 Weeks

### 1) Secrets Hygiene (P0)
**Goal:** Ensure no secrets are leaked and establish rotation procedures.

**Tasks:**
- Rotate Discord/Twitch/YouTube/OpenWeather/DB secrets
- Ensure `.env` files aren't quoted and aren't tracked
- Update ENVIRONMENT.md with a crisp rotation guide
- Prefer a single source for `DATABASE_URL` via compose

**Outcome:** Secure environment with documented rotation procedures.

---

### 2) Birthdays Dashboard MVP (P0)
**Goal:** Enable guild admins to manage birthdays via dashboard.

**Tasks:**
- Page: `/dashboard/birthdays/[guildId]` with list + add/remove and channel selection
- Use existing API; if needed, add "list by guild" and "upcoming" endpoints
- Keep UI minimal (table + dialog)
- CSRF/JWT protection enforced

**Outcome:** Admins can manage birthdays without bot commands.

---

### 3) Bot Command: Upcoming Birthdays (P0)
**Goal:** Let users see upcoming birthdays in their guild.

**Tasks:**
- Slash command `/birthdays upcoming [count=5]` (ephemeral)
- Lists the next N birthdays in the guild
- Sort by next occurrence; handle Feb 29
- Tests for sorting and edge cases

**Outcome:** Users can check upcoming birthdays easily.

---

### 4) Ops Guardrails (P0)
**Goal:** Ensure reliable operations on 2GB VPS.

**Tasks:**
- Add backup notes for a simple daily `pg_dump` under `./data/backups/`
- Document restore steps
- Document conservative memory settings: `NODE_OPTIONS=--max-old-space-size=128` for API/Bot
- Document small DB pool configuration

**Outcome:** Reliable backups and memory management on limited resources.

---

## Next 2–4 Weeks

### 5) Per-Guild Time + Timezone for Birthdays (P1)
**Goal:** Support different timezones and announcement times per guild.

**Tasks:**
- Config + migration for per-guild timezone and HH:mm send time
- Job respects per-guild schedule (still idempotent)
- Dashboard controls for these fields

**Outcome:** Flexible birthday announcements respecting guild preferences.

---

### 6) API Helper: Upcoming Birthdays (P1)
**Goal:** DRY principle for upcoming birthdays logic.

**Tasks:**
- GET `/birthdays/:guildId/upcoming?limit=5&windowDays=60` with computed `nextDate`
- Zod validation + tests
- Used by dashboard and bot command

**Outcome:** Single source of truth for upcoming birthdays calculation.

---

### 7) Notifications UI Polish (P1)
**Goal:** Better control over notification behavior in dashboard.

**Tasks:**
- Minimal controls for mentions/pings and YouTube enrichment toggle
- Keep backend untouched
- Validation wired properly

**Outcome:** More flexible notification configuration.

---

## Deferred (Keep Simple on 2GB)

- ❌ **Metrics exporter/Prometheus** — Current logs and DB-backed jobs are fine
- ❌ **Redis** — Only add when distributed rate limits or queues are actually needed
- ❌ **Release pipelines** — `:latest` tags work fine for single VPS deployment

**Rationale:** Every new service eats RAM and adds ops complexity. Current architecture is perfect for 2GB single-node setup.

---

## Quality Gates

- ✅ Keep TypeScript strict and ESM; use `.js` extensions for local imports
- ✅ Named exports only (no `export default`)
- ✅ Tests for new public behavior (Vitest; shared helpers from `fakegaming-common/testing`)
- ✅ Update `ISSUES_TODO.md` after each shipped item with a one-line status
- ✅ Security scanning with CodeQL before finalizing changes
- ✅ Code review before completion

---

## Quick Validation Once Shipped

### Dashboard:
1. Navigate to `/dashboard/birthdays/<guildId>`
2. Add a birthday and channel
3. Verify it shows in the list
4. Edit/delete works correctly

### Bot:
1. Run `/birthdays upcoming` in a guild
2. Verify ordering is correct (next occurrence from today)
3. Verify Feb 29 handling (on non-leap years)
4. Verify empty state message

---

## Project Guidance (Honest Assessment)

### ✅ What's Working Well
- **Architecture is solid** for single-node setup: DB-backed jobs, idempotent notifications, minimal dependencies
- **Perfect for 2GB box:** No unnecessary services, conservative resource usage
- **Comprehensive documentation:** Clear guides for development, deployment, testing, migrations
- **Strong type safety:** Strict TypeScript with ESLint enforcement
- **Good testing infrastructure:** Shared helpers, consistent patterns, 80% coverage target

### 🎯 Where to Invest
- **User-facing features:** Birthdays (UI + command), reliable notifications
- **Ops basics:** Backups, memory flags, rotation procedures
- **Documentation:** Keep it updated as features ship

### ⚠️ What to Avoid
- **Adding Redis** — DB-backed cache works fine; only add when you truly need cross-process functionality
- **Adding Prometheus** — Logs are sufficient; metrics can wait until you outgrow the box
- **Heavy background processors** — Keep jobs centralized in API; bot stays thin

### 🔄 When to Re-evaluate
When you outgrow the 2GB box, consider this migration path:
1. **First:** Move metrics (lightweight Prometheus exporter)
2. **Then:** Redis if you need cross-process rate limits or distributed queues
3. **Later:** Separate job worker process if needed

---

## Related Documentation

- [ISSUES_TODO.md](./ISSUES_TODO.md) - Detailed backlog with acceptance criteria
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture patterns and decisions
- [ENVIRONMENT.md](./ENVIRONMENT.md) - Environment setup and configuration
- [README.md](./README.md) - Project overview and quick start
- [CONTRIBUTING.md](./CONTRIBUTING.md) - How to contribute

---

## Status Updates

**Last Updated:** 2025-10-29  
**Next Review:** After completing any P0 item or in 2 weeks (whichever comes first)
