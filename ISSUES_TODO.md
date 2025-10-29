# Issues Backlog — Reset (as of 2025-10-29)

## Purpose
- Fresh, compact backlog that reflects what's actually worth doing next on a 2GB VPS, without extra services.
- Keep scope tight; ship small vertical slices. When you complete an item, update status here and mirror a short note in `NEXT_STEPS.md`.

## Legend
- **Status:** PENDING, IN_PROGRESS, DONE, DEFERRED
- **Priority:** P0 (must), P1 (should), P2 (nice)
- **Each item:** Description, Acceptance Criteria, Notes/Refs

---

## Snapshot of What's Already in Place (Verified Quick Scan)
- ✅ Birthdays model/manager/API/job exist: `packages/common/src/managers/birthdayManager.ts`, `packages/api/src/routes/birthdays.ts`, `packages/api/src/jobs/birthdays.ts` (daily at 09:00 server time; idempotent via Notifications).
- ✅ Notifications dedupe table + manager present; used by birthdays to avoid duplicates.
- ✅ Jobs infra present in API with Postgres-backed adapter (`pg-boss`) and memory fallback; bootstrap wired behind `JOBS_ENABLED`.
- ✅ API rate limiting middleware exists.
- ✅ Dashboard exists and is auth/CSRF/JWT-hardened.

---

## P0 — Must Do Next

### 1) Security: Rotate secrets and fix .env hygiene (Status: PENDING)
**Description:** Assume secrets are compromised; rotate Discord/Twitch/YouTube/OpenWeather/DB creds; remove quotes in dotenv files and ensure nothing sensitive is tracked.

**Acceptance:**
- All affected tokens/keys rotated; services restart cleanly with updated env.
- `.gitignore` ignores all `.env*` except examples; CI guard keeps them out of git.
- `ENVIRONMENT.md` has an up-to-date "How to rotate" section; compose docs reference a single source for `DATABASE_URL`.

**Notes/Refs:** 
- `docker-compose.yml`
- `scripts/check-env-leaks.*`
- `ENVIRONMENT.md`
- See existing rotation guide in ENVIRONMENT.md (lines 382-389)

---

### 2) Birthdays Dashboard — MVP (Status: PENDING)
**Description:** Simple guild-scoped page to list, add, and remove birthdays; pick announcement channel. Keep it minimal and fast.

**Acceptance:**
- Page: `/dashboard/birthdays/[guildId]` with list (user, date, channel) and basic CRUD.
- Uses existing API routes; if needed, add a small API to list birthdays by guild and (optional) upcoming view window.
- CSRF enforced for mutations; JWT auth used; error shape matches existing API convention.
- Basic empty-state and loading skeleton; no heavy analytics or charts.

**Notes/Refs:** 
- `packages/api/src/routes/birthdays.ts` (may add GET by guild and GET upcoming)
- Existing dashboard patterns under `/dashboard/*/[guildId]`

---

### 3) Bot: Upcoming birthdays command (Status: PENDING)
**Description:** Add a slash command to display the next N birthdays in the current guild; ephemeral by default to avoid spam.

**Acceptance:**
- Command: `/birthdays upcoming [count=5]` (guild-only). Lists user mentions + date; handles Feb 29 correctly.
- Leverages BirthdayManager data; sorts by next occurrence from "today".
- Respects DisabledModule/DisabledCommand configuration.
- Tests cover sorting, Feb-29-on-non-leap-year behavior, and empty state.

**Notes/Refs:** 
- Existing command `packages/bot/src/modules/birthdays/commands/birthday.ts`
- Use similar structure and manifest

---

### 4) Ops: Backups and memory guardrails (Status: PENDING)
**Description:** Add a simple daily `pg_dump` backup and document memory limits for Node and Postgres suited to 2GB RAM.

**Acceptance:**
- Documented `pg_dump` one-liner and restore steps; path for volume-mounted backups under `./data/backups/`.
- Recommended Node flags in compose/env: `NODE_OPTIONS="--max-old-space-size=128"` for API/Bot; small DB pool size.
- Postgres notes: keep defaults conservative; avoid exposing externally by default.

**Notes/Refs:** 
- `docker-compose.yml`
- `ENVIRONMENT.md`

---

## P1 — Should Do (Soon)

### 5) Birthdays: per-guild announcement time and timezone (Status: PENDING)
**Description:** Move from server-local 09:00 to per-guild schedule with timezone support.

**Acceptance:**
- Config fields for timezone (IANA) and hour:minute; safe defaults.
- Jobs respect per-guild scheduling (still idempotent per day via Notifications).
- Migration + validation; dashboard fields to edit these settings.

**Notes/Refs:** 
- `computeNextDailyRunDelaySeconds` used today
- Will need per-guild expansion

---

### 6) API: Upcoming birthdays endpoint (Status: PENDING)
**Description:** Small read-only endpoint to return next N upcoming birthdays for a given guild, window default 30–60 days.

**Acceptance:**
- GET `/birthdays/:guildId/upcoming?limit=5&windowDays=60` (or similar) returns sorted list with computed nextDate.
- Zod validation + shared error shape; tested.
- Dashboard and bot command can both call this to avoid duplicating the logic.

**Notes/Refs:** 
- BirthdayManager
- Consider adding a pure function in common to compute "next occurrences"

---

### 7) Notifications (UI polish only) (Status: PENDING)
**Description:** Expose mentions/pings and enrichment toggle in dashboard for Twitch/YouTube; keep backend as-is.

**Acceptance:**
- Minimal controls in settings; validations wired; no quota-heavy defaults.
- No extra services introduced; retain DB-backed jobs.

---

## P2 — Nice to Have

### 8) Metrics: Keep as logs for now; consider Prometheus later (Status: DEFERRED)
**Description:** Today's periodic summary logs are enough. Revisit exporter when memory/headroom improves.

**Acceptance:** N/A now; decision recorded.

**Notes:** Current logs and DB-backed jobs are sufficient for 2GB VPS.

---

### 9) Redis/alternative backends (Status: DEFERRED)
**Description:** Only consider when you actually need distributed rate limits or queues.

**Acceptance:** N/A now; keep interfaces small so swap-in is easy.

**Notes:** DB-backed cache and jobs work well for single-node deployments.

---

### 10) Release pipeline and image tagging (Status: DEFERRED)
**Description:** CI builds and pushes images per package with SHA tags; low priority on a single VPS.

**Notes:** Current setup uses `:latest` tags which is fine for single-deployment scenario.

---

## Chores / Hygiene

- [ ] Prune verbose docs that drift; prefer this single backlog + a brief `NEXT_STEPS.md`.
- [ ] Keep tests lean and green; use `@zeffuro/fakegaming-common/testing` helpers.
- [ ] Avoid quota/runtime surprises: keep YouTube enrichment off by default; keep poll intervals conservative.
- [ ] Update command table in README.md when adding new commands (auto-generated via CI).

---

## How to Use This File

1. **Update status inline** as you ship items.
2. **Split scope creep** into a new P1/P2 item rather than expanding acceptance criteria.
3. **Keep references accurate** to reduce code search time when you (or future-you) pick an item up.
4. **Cross-reference with NEXT_STEPS.md** for a roadmap view.

---

## Related Documentation

- [NEXT_STEPS.md](./NEXT_STEPS.md) - Lean roadmap and focus areas
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture patterns and decisions
- [ENVIRONMENT.md](./ENVIRONMENT.md) - Environment setup and configuration
- [MIGRATIONS.md](./MIGRATIONS.md) - Database migration guide
- [CONTRIBUTING.md](./CONTRIBUTING.md) - How to contribute to the project
