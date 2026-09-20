# Verification

Status: **local-verified**. Live xCloud deployment **NOT RUN** in this session.
Date: 2026-09-20. Repo: `xCloudNobin/deploy-test-express`, branch `feat/compatibility-taskboard`.

## Environment (local)

- Node.js `v22.23.2`, npm `10.9.8`
- express `5.2.1`, better-sqlite3 `13.0.3` (prebuilt binary, no compiler/apt usage)
- OS: Linux (container workspace)
- All tests/smoke use unique ephemeral ports and isolated temp SQLite files under `os.tmpdir()`; a repo-local isolated checkout is created for the smoke run. No native runtime mutations.

## Commands and results

### 1. Clean install (lockfile)

```
$ npm ci --omit=dev --no-audit --no-fund   (reproduced inside isolated smoke checkout)
# succeeded — no compilation required
```

### 2. Automated test suite

```
$ npm test
1..17
# tests 17
# suites 0
# pass 17
# fail 0
# cancelled 0
# duration_ms 502.9
```

Covered behaviors: home page UI served; `/health` wire-compatible payload; `/ready` ok with live DB; idempotent seed present; project CRUD; task CRUD with status; project-delete cascades tasks; search (`q`) and status/project filters; validation errors → 400 (blank/missing title, invalid status, missing/bad project_id, bad query status, non-object body); malformed JSON → 400; not-found → 404 (unknown route, unknown entity ids); readiness + API degraded (`/ready` 503, `/api/*` 503) when store unavailable while `/health` stays 200; data persists across a store reopen on the same file; seed does not duplicate on reopen.

### 3. Production smoke (real process, real HTTP)

```
$ npm run smoke
=== result: ALL CHECKS PASSED (47 total) ===
```

The smoke script copies the app to an isolated temp checkout, `npm ci`s it, boots the **actual production process** (`node server.js`) on a free port, and asserts 47 checks against real HTTP responses:

- **Boot A (fresh temp DB):** `/ready` 200 with `dependencies.database=up` and build marker; `/health` compatible; seeds present; project create (201); task create (201); read by id; project detail groups tasks; search matches; `projectId` and `status` filters; PATCH task; UI page + static assets 200; `/api/info` build marker.
- **Negative:** malformed JSON → 400; non-object JSON body → 400; blank/missing title → 400; invalid status → 400; unknown project_id → 404; unknown task/project ids → 404; unknown API route → 404; unknown page → 404.
- **Clean shutdown:** SIGTERM → exit code 0.
- **Persistence (Boot B):** same `DATABASE_PATH`, fresh process → `/ready` 200; persisted task title and `done` status survive restart; exactly one persisted record (seed not duplicated); persisted project survives; build marker reflects new boot.
- **Dependency-aware readiness:** server started with an un-openable `DATABASE_PATH` stays alive (`/health` 200) while `/ready` → 503 `dependencies.database=down` and `/api/projects` → 503; clean shutdown.

### 4. Manual production run

`DATABASE_PATH=/tmp/... npm start` observed `[db] sqlite ready ... (probe ok)`, `listening on 127.0.0.1:<port>`, `/health` → `{"status":"ok","app":"deploy-test-express"}`, `/ready` → `{"status":"ok","dependencies":{"database":"up"}}`, CRUD round-trip via curl, restart with same DB preserved `Manual` project → then temp dir removed.

## Schema / persistence notes

- Idempotent `CREATE TABLE IF NOT EXISTS` for `projects` and `tasks` plus foreign-key cascade; WAL mode; parameterized queries throughout; UI escapes user data (text-based DOM building).
- Seed runs only when `projects` is empty → deterministic, repeatable, no duplication on restart.
- Production `DATABASE_PATH` must be a **persistent volume outside the release checkout** (documented in README and `.env.example`). Default `./data/` is for local convenience only.

## Security/licensing notes

- MIT license added (no conflicting license existed in the source repo; upstream has no notices to preserve beyond README).
- No hardcoded credentials; `.env.example` uses safe placeholder values; logs contain no credentials.
- No cookies/auth are used in this demo, so CSRF protection is not applicable; this is explicitly documented as a public-demo limitation along with the absence of auth/rate limiting.

## Limitations / not done

- **Live xCloud deployment: NOT RUN.** Status remains `local-verified`; `deployment_verified` is NOT claimed. Live qualification on the intended xCloud category + external readiness/health checks + persistence-on-redeploy check at the exact candidate commit are required before marking `deployment-verified`.
- No external reviewer sign-off has been recorded yet (agent self-report only).
- Docker not used; native (node + better-sqlite3) production process verified directly.