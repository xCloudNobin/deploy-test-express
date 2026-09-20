# deploy-test-express — TaskBoard

A compact, production-ready task/project board built with **Express 5** and persistent **SQLite** storage. Projects group tasks; tasks support create/read/update/delete, a `todo | in_progress | done` status, and client-side + API search/filter. The original deployment-test app was upgraded to a meaningful demo while keeping the `/health` route wire-compatible.

## Features

- Project grouping with tasks, counts, and descriptions.
- Full CRUD for projects and tasks via a JSON API (`/api/...`).
- Status field per task with server-side validation.
- Search (`q`) and filters (`projectId`, `status`) — backed by parameterized SQL.
- Real SQLite persistence via `better-sqlite3`, deterministic idempotent schema init and repeatable seed data.
- Liveness (`/health`) and dependency-aware readiness (`/ready`) endpoints.
- Non-sensitive build/release marker in the UI footer and `/api/info`.
- Client UI escapes all user data (text-based DOM, no unsafe `innerHTML` interpolation).
- No authentication/cookies by design — see [Public demo limitations](#public-demo-limitations).

## Requirements

- Node.js **>= 22** (verified on Node `v22.23.2`).
- npm **>= 10** (lockfile v3).
- `better-sqlite3` ships prebuilt binaries for common platforms; no compilers required.

## Install

```bash
npm ci            # clean, reproducible install from lockfile
```

## Configure

Copy `.env.example` to `.env` (or export env vars). No secrets are required. Worker process defaults are production-safe:

| Variable         | Required | Default                                | Meaning                                                        |
| ---------------- | -------- | -------------------------------------- | -------------------------------------------------------------- |
| `HOST`           | no       | `0.0.0.0`                              | Bind address (all interfaces so the platform can route traffic).|
| `PORT`           | no       | `3000`                                 | Port to listen on.                                             |
| `DATABASE_PATH`  | no       | `./data/taskboard.sqlite`              | SQLite file. **Must point outside the release checkout in prod.** |
| `BUILD_MARKER`   | no       | `local-<gitref>-<version>`             | Non-sensitive build/release label shown in UI and `/api/info`. |
| `NODE_ENV`       | no       | (unset)                                | Set to `production` in production.                             |

**Persistence (important):** the SQLite file must live in a persistent volume that survives deployments. Ephemeral release directories get wiped on redeploy — set `DATABASE_PATH` to a mounted volume (e.g. `/var/lib/taskboard/taskboard.sqlite`) or an external SQLite store. Data, schema, and seed state are never stored only inside the release checkout.

## Run (production)

```bash
# verify then start
npm test
npm start
```

Production server binds to `0.0.0.0:<PORT>` (configurable). Logs go to **stdout/stderr** with no credentials. Graceful shutdown on `SIGTERM`/`SIGINT` closes the HTTP server and the SQLite handle, with a 10s force-exit fallback.

### Process management

```bash
# example — run as a service under a process manager of your choice
DATABASE_PATH=/var/lib/taskboard/taskboard.sqlite NODE_ENV=production PORT=3000 npm start
```

There are no background workers/jobs — the single server process owns the worker pool.

### Health / readiness

- `GET /health` — **liveness**, process-is-alive. Response body is wire-compatible with the original app: `{ "status": "ok", "app": "deploy-test-express" }`.
- `GET /ready` — **readiness**. Runs a real SQLite probe (`SELECT 1`) against the open handle. Returns `200 { dependencies: { database: "up" }, build }` when healthy, and `503` with `database: "down"` when the database is unavailable (including when the server booted in degraded mode because the DB file could not be opened).

The app intentionally continues serving `/health` even when the database is down, so liveness and readiness are independent.

### Build marker

The UI footer and `GET /api/info` expose a `build` marker (`BUILD_MARKER` env or a `local-<gitref>-<version>` default). This lets you distinguish which deployed revision is running. It is non-sensitive by design.

## API

All mutations accept `application/json`; responses are JSON. Integer ids are validated; strings are trimmed, length-capped, and parameterized. All error responses set a sensible HTTP status and a JSON `{ error, code }` body.

| Method | Path                     | Description                                   |
| ------ | ------------------------ | --------------------------------------------- |
| GET    | `/api/projects`          | List projects with task counts.               |
| POST   | `/api/projects`          | Create project `{ name, description? }`.      |
| GET    | `/api/projects/:id`      | Project detail including its tasks.           |
| PATCH  | `/api/projects/:id`      | Update `{ name?, description? }`.             |
| DELETE | `/api/projects/:id`      | Delete project (cascades tasks).              |
| GET    | `/api/tasks`             | List tasks. Query: `projectId`, `status`, `q`.|
| POST   | `/api/tasks`             | Create task `{ project_id, title, status?, description? }`. |
| GET    | `/api/tasks/:id`         | Task detail.                                  |
| PATCH  | `/api/tasks/:id`         | Update `{ title?, status?, description?, project_id? }`. |
| DELETE | `/api/tasks/:id`         | Delete task.                                  |
| GET    | `/api/info`              | App/runtime/framework/version/build marker.   |

Validation failures → `400`; missing entities → `404`; malformed JSON → `400`; oversized body → `413`; database down → `503` on `/api/*` and `/ready`; unknown API route → `404`.

## Schema & seeds

Idempotent `CREATE TABLE IF NOT EXISTS` with a `CHECK` constraint on `status` and a foreign key cascade from projects → tasks:

- `projects` (`id`, `name`, `description`, `created_at`)
- `tasks` (`id`, `project_id` FK → projects ON DELETE CASCADE, `title`, `description`, `status`, `created_at`, `updated_at`)

Seed data (two example projects with tasks across all three statuses) inserts **only when the `projects` table is empty**, so reseeding is deterministic and never duplicates user records on restart.

## Test & smoke

```bash
npm test         # node:test integration suite (17 tests, ephemeral temp DBs)
npm run smoke    # production smoke + persistence proof (starts the real process)
```

`npm run smoke`:

1. Copies the app to an isolated temp checkout, runs `npm ci` there.
2. Boots the **actual production process** (`node server.js`) on a free port with an isolated temp SQLite path.
3. Performs HTTP CRUD, search/filter, and negative tests (malformed JSON, invalid status, missing fields, 404s, UI pages, build marker).
4. Shuts down cleanly (asserts exit code 0), restarts him with the **same** SQLite file, and proves the record survived with no duplicate seed.
5. Verifies dependency-aware readiness: with an un-openable DB path the process stays alive (`/health` 200) while `/ready` and `/api/*` return `503`.
6. Cleans up temp files.

See `VERIFICATION.md` for the latest captured results.

## Public demo limitations

- **No authentication/authorization or CSRF protections** — mutations are unauthenticated by design for this public demo. Anyone with network access to the deployed port can create/edit/delete data. Do not expose to untrusted networks without adding auth.
- Demo data is shared by all visitors; it is intentionally ephemeral and resets to seed only on a fresh database.
- No rate limiting, quotas, or multi-tenant isolation. Not suitable as a public SaaS backend as-is.
- The DB must be configured to a persistent volume; default `./data/` is inside the checkout and is only for local convenience.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 xCloudNobin.