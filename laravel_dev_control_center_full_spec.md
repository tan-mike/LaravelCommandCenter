# Laravel Dev Control Center — Full Specification

## 1. Overview
A cross-platform *developer helper suite* built to speed up development, debugging, and maintenance of Laravel applications. It centralizes project discovery, log intelligence, route/model analysis, one-click repair macros, test helpers, and deployment checks into a single UI + CLI toolset.

Targeted outcomes:
- Reduce onboarding time for new developers
- Reduce mean-time-to-detect and mean-time-to-fix errors
- Automate repetitive maintenance tasks
- Surface Laravel-specific code smells and performance traps

## 2. Audience & Personas
- **Solo dev / freelancer** — wants fast local tooling and quick diagnostics.
- **Team developer** — wants consistent generators, health checks, and shared conventions.
- **SRE / DevOps** — wants deployment simulations and lightweight monitoring integrations.
- **QA / Tester** — uses request simulator and test helpers for reproducible test scenarios.

## 3. Core Guiding Principles
- Non-invasive: read-only by default; destructive actions require explicit confirmation.
- Laravel-aware: conventions and heuristics tailored to Laravel ecosystem.
- IDE-friendly: deep links to open files in common editors/IDEs.
- Extensible: plugin architecture for project-specific rules and macros.
- Observable: audit log of actions and telemetry for the tool itself.

## 4. High-level Architecture
- **Client UI**: Electron + React (or Tauri + React) for cross-platform desktop, or optional web UI served locally.
- **Backend**: Node.js or PHP CLI service acting as bridge to Laravel project (runs Artisan commands, reads files). Use zero-dependency (native OS APIs + Composer/Artisan) wherever possible.
- **Local data store**: SQLite for tool metadata + configuration. Optional: Elasticsearch / SQLite+FTS for log indexing.
- **Optional remote server**: for team features (shared error aggregation, license, telemetry) — can be self-hosted.
- **CLI wrapper**: `devctl` that mirrors UI actions for scripting and CI integration.

Diagram (logical):

```
[Developer] <-> [UI Client (Electron/Tauri)] <-> [Local Bridge Service (Node/PHP)] <-> [Laravel Project files + Artisan + DB]
                                      |
                                      -> [Local SQLite / Optional ES]
                                      -> [Optional Remote Aggregator]
```

## 5. Feature Set (detailed)
Each feature listed with user stories, acceptance criteria, implementation notes.

### 5.1 Project Autodetection & Command Intelligence
**User stories**
- As a developer, I can open a project and immediately see available artisan commands, custom commands, and basic health info.

**Acceptance criteria**
- Detect `artisan` file and `composer.json` automatically.
- Parse `app/Console/Commands` and `src` for classes extending `Command`.
- List discovered queues, events, mailers, scheduled commands, and `.env` keys used by code (safe subset: not printing secrets).

**Implementation notes**
- Use static parsing (AST) for PHP to extract command signatures and docblocks. Alternatively use `php artisan list --format=json` for runtime discovery.
- Show `composer.json` dependencies and highlight major Laravel packages (Telescope, Nova, Sanctum, Passport).

**UI**
- "Project Summary" card with quick actions: `artisan migrate --status`, `artisan route:list`, `artisan queue:failed`.

**CLI**
- `devctl project:scan /path/to/project` -> prints JSON summary.

---

### 5.2 One-click Troubleshooting Macros
**User stories**
- As a dev, I want one-click macro to do common fixes (clear caches, restart queue workers) without memorizing commands.

**Macros**
- `Clear caches` -> runs `config:cache`, `route:cache`, `view:clear`, `cache:clear`, `optimize:clear`.
- `Rebuild autoload` -> runs `composer dump-autoload`.
- `Retry failed jobs` -> lists and retries failed jobs (with filter).
- `Check schedule` -> validates `crontab -l` for schedule entry and runs `schedule:run --no-interaction --example`.

**Safety**
- Provide preview modal showing exact shell commands and a confirmation checkbox.

**CLI**
- `devctl macro clear-caches`

---

### 5.3 Log Intelligence & Error Aggregation
**User stories**
- As a dev, I want to see grouped errors, spike detection, and quick open-to-editor for traces.

**Capabilities**
- Tail logs in real-time (local file or remote via SSH/SFTP).
- Group by exception type and stack trace fingerprint (normalized file paths and line numbers).
- Collapse multi-line errors into single grouped items.
- Show recent deploy/githash context (if available via env or deploy metadata).
- Spike detection: compare error rate with historical baseline and flag anomalies.
- Link stack frames to editor using `vscode://file/{path}:{line}` or `phpstorm://open?file={path}&line={n}`.
- Provide quick actions: copy stack, open file, create issue (GitHub/GitLab), mark as assigned.

**Data model (logs)**
- `errors` table (or ES index): id, fingerprint, title, message, first_seen, last_seen, count, sample_trace, status (open/assigned/resolved), tags, source
- `events` table: timestamp, level, message, meta

**Indexing strategy**
- Option A: lightweight SQLite + FTS for small projects.
- Option B: Elasticsearch for large log volumes; shiper for remote hosts.

**CLI**
- `devctl logs tail --file storage/logs/laravel.log --group-by exception`.

---

### 5.4 Route Explorer + Reverse Lookup
**User stories**
- As a dev, I want to find which routes map to a controller, or which middleware is attached to a path.

**Capabilities**
- Interactive searchable route table (method, path, name, action, middleware, guards).
- Click action to "Open Controller" in IDE.
- Comparison tool: `diff` routes between two branches or commits.
- Highlight potential traps (overly generic wildcard routes, missing auth middleware).

**CLI**
- `devctl route:explore` -> launches UI; `devctl route:diff branchA branchB` -> shows textual diff.

---

### 5.5 Model & DB Analyzer
**User stories**
- As a dev, I want to know mismatches between Eloquent models and DB schema and detect potential N+1 sites.

**Capabilities**
- Read DB schema (via DB connection) and compare to model attributes and casts.
- Flag missing casts or appended attributes that don't exist in DB.
- Detect `belongsTo`/`hasMany` relationships declared without foreign key existence.
- N+1 detector: static analysis + runtime detection from logs or from simple HTTP tracing in dev mode.

**Outputs**
- A checklist of recommended changes with one-click generator for casts or migration stubs.

**CLI**
- `devctl model:audit --connect` -> returns JSON report.

---

### 5.6 Environment Health Check (Doctor)
**User stories**
- As a dev or ops, I want a single command that checks the runtime environment and lists fixes.

**Checks**
- PHP version, required extensions, composer dependencies, config cache mismatch, storage link, `APP_KEY` presence, filesystem permissions for `storage` and `bootstrap/cache`, queue driver accessibility, mail driver, redis connectivity.

**Output**
- Color-coded report (OK / Warning / Critical) with suggested commands.

**CLI**
- `devctl doctor` -> prints report + JSON output for CI.

---

### 5.7 Testing Helpers
**User stories**
- As a dev, I want auto-generated test stubs and the ability to run tests affected by recent changes.

**Capabilities**
- Generate PHPUnit/Laravel test skeletons from controllers and FormRequests.
- Run `phpunit` only for tests related to changed files (via git diff mapping).
- Local DB sandbox: spawn disposable sqlite or dockerized MySQL for test runs.

**CLI**
- `devctl test:generate Controller/InvoiceController` -> creates tests/Feature/InvoiceControllerTest.php
- `devctl test:affected` -> runs subset of tests.

---

### 5.8 API / Request Simulator
**User stories**
- As a developer, I want to craft requests directly from validation rules and see DB queries and events triggered.

**Capabilities**
- List routes and build request form using controller method signature or FormRequest rules (auto-detect `rules()` array).
- Run the request in a sandboxed environment and show resulting DB queries, events, notifications, and response JSON.
- Save requests as "playbooks" that can be re-run.

**UI**
- Route list -> select route -> form auto-generated -> run -> see timeline: request > validation > controller > queries > events > response.

**CLI**
- `devctl api:call POST /api/user -d @payload.json`

---

### 5.9 Deployment Simulator & Preflight
**User stories**
- As a dev/ops, I want to simulate deployment steps locally and get warnings about likely failures.

**Capabilities**
- Run preflight checklist: run migrations in a `--dry-run` mode (generate SQL and show potential conflicts), check `php artisan config:cache` safe to run, service provider boot durations (profile via `--profile` flag), cache/route compilation errors, composer install check.
- Produce a detailed `deployment-report.json` that CI can consume.

**CLI**
- `devctl deploy:simulate --branch release/1.2.0`

---

### 5.10 Code Generators & Conventions Enforcer
**User stories**
- As a developer, I want a standardized generator that scaffolds controllers/services/actions/jobs respecting team conventions.

**Capabilities**
- `devctl make action Payments/ChargeCustomer --type=invokable --test` -> creates class, binding, and test stub.
- Enforce file headers, namespaces, and optional docblock templates.
- Optionally register generated files into `composer.json` autoload or a service provider.

**CLI**
- `devctl make <type> <Name> [--options]`

---

### 5.11 Code-Smell Detector (Laravel Rules)
**User stories**
- As a maintainer, I want a quick report of Laravel-specific anti-patterns to prioritize refactor work.

**Rules (examples)**
- Controller > 300 lines (alert)
- Public methods > 40 lines
- Query builders inside loops (heuristic via AST)
- Repeated inline validations that should be FormRequest
- Views with > 2000 lines

**Output**
- A prioritized list of smell items with suggested remediation and one-click refactor scaffolding when possible.

**CLI**
- `devctl lint:laravel` -> returns JSON lint report compatible with GitHub code scanning.

---

## 6. Integrations & Editor Links
- VSCode: `vscode://file/{path}:{line}`
- PHPStorm: `phpstorm://open?file={path}&line={line}`
- GitHub/GitLab: create issue from error or stacktrace via OAuth integration.
- Docker: optional run of project containers for sandboxed tasks.
- SSH: tail remote logs and run remote Artisan commands through SSH gateway (with key management and audit logs).

## 7. Security & Safety Model
- Read-only by default: destructive macros require `--confirm` or explicit UI confirmation.
- Secrets handling: never display raw values of `APP_KEY`, database passwords, or other credentials; only show presence/absence or masked values.
- Access control: local tool can integrate with OS user accounts; optional remote team server requires OAuth + role-based permissions.
- Audit trail: record actions like `cleared cache`, `retried job`, `opened file in editor` with timestamp and actor (local username).

## 8. Storage and Data Model (summary)
- `projects` table (id, path, name, last_scan_at, config)
- `errors` table (fingerprint, title, sample_trace, count, first_seen, last_seen, status, tags)
- `macros` table (name, script, last_run_at, run_count)
- `playbooks` (saved API calls)
- `smells` (rule, file, severity, notes)

Use SQLite for single-user; provide an adapter to use PostgreSQL/Elasticsearch for team mode.

## 9. Performance & Scalability
- For local usage: keep memory footprint low, scan files lazily, avoid indexing entire node_modules or vendor directories.
- For large projects where log volume is high, recommend shipping logs to Elasticsearch or a hosted aggregator and using the remote aggregator for heavy queries.

## 10. Observability & Telemetry
- Collect anonymized telemetry (opt-in) to improve default rules and shipping templates. Allow an opt-out.
- Instrument long-running tasks and provide progress bars and estimated step completion counts, not time estimates.

## 11. UX / UI Sketches (text)
- **Left nav**: Projects > Logs > Routes > DB > Macros > Tests > Generators > Settings
- **Top bar**: project selector, quick search (files/routes/commands), run macro button
- **Main panel**: context-specific cards. Example: Logs view with grouped errors left, selected error detail right (stack, samples, assign button).
- **Command palette**: `Ctrl/Cmd+K` to run commands like `macro:clear-caches` or `open route login`.

## 12. CLI surface (examples)
- `devctl project:scan /path` -> prints JSON
- `devctl macro clear-caches --yes`
- `devctl logs tail --file storage/logs/laravel.log --group-by fingerprint`
- `devctl route:diff branchA branchB`
- `devctl test:generate Controller/InvoiceController`
- `devctl doctor --format=json`

All CLI commands support `--project /path` and `--dry-run` where applicable.

## 13. Plugin / Extension System
Allow users to write plugins (Node/PHP) that register:
- custom lint rules
- custom macros
- custom UI panels

Plugin manifest: `devctl-plugin.json` with schema: id, version, entrypoint, permissions.

## 14. Security Review Checklist (for shipping)
- No secrets logged or exposed
- Confirm all remote integrations use OAuth or SSH keys; never store passwords in plaintext
- Sandbox any code execution (macros) with safe default: `--confirm` and optional dry-run
- Supply automatic updates signed by vendor (if distributing binaries)

## 15. Testing Strategy
- Unit tests for parsers (routes, commands, AST-based detectors)
- Integration tests that run against small sample Laravel projects in CI (use fixtures)
- E2E tests for UI (Playwright)
- Fuzzing for log parsers to avoid crashes on malicious logs

## 16. Roadmap & Milestones (12-week plan)
**MVP (4 weeks)**
- Project detection, artisan listing, basic macros (clear caches, rebuild autoload)
- Local CLI: `project:scan`, `macro:clear-caches`
- Basic log tail & grouping (SQLite-backed)

**v1 (next 4 weeks)**
- Route explorer with open-in-editor, model/db analyzer, doctor command
- Basic UI (Electron) with project selector
- Generate test stubs and `test:affected`

**v2 (final 4 weeks)**
- Error spike detection, integrations (GitHub issues), deployment simulator, plugin system
- Team mode: remote aggregator + authorization

## 17. Metrics of Success
- Time to onboard new project (goal: < 15 min to useful state)
- Mean time to resolution for errors detected via tool (target: 25% reduction)
- Adoption: % of team using tool daily
- Reduction in common code smells over time (tracked by `smells` reports)

## 18. Developer Handoff / Docs
- Developer README with architecture and runbook
- Plugin author guide
- API docs for `devctl` CLI
- Security policy and data retention

## 19. Example JSON outputs
**Project scan (example)**

```json
{
  "path": "/Users/mike/projects/clinic",
  "laravel_version": "10.14",
  "artisan_commands": [
    {"name":"users:notify","signature":"users:notify {user}","description":"Notify a user"}
  ],
  "queues": ["default","emails"],
  "scheduled": ["daily:cleanup"],
  "missing_storage_link": true
}
```

**Log group example**

```json
{
  "fingerprint": "Illuminate\\Database\\QueryException:select ...",
  "count": 54,
  "first_seen": "2025-12-10T08:45:00Z",
  "last_seen": "2025-12-11T09:02:04Z",
  "sample_trace": [
    {"file":"/var/www/app/Http/Controllers/UserController.php","line":227}
  ],
  "status":"open"
}
```

## 20. Open Questions (decisions to make)
- Desktop vs web-first: which distribution model do we want? Desktop (Electron/Tauri) has better local file/IDE integration.
- Log indexer: SQLite FTS vs Elasticsearch. Start with SQLite for MVP.
- Plugin language: Node vs PHP? Node plugins are easier for UI; PHP plugins have direct access to project runtime. Consider supporting both via a defined IPC.

## 21. Next actions (for you)
- Choose MVP stack (Electron+Node backend recommended) and confirm data store choice (SQLite for MVP).
- Identify 3–5 must-have macros for MVP (I recommend: clear caches, rebuild autoload, retry failed jobs, check schedule, doctor).
- Pick distribution model (binary releases or npm/Composer package + user-level installer).

---

*End of specification.*

