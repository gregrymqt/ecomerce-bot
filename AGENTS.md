<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->

# E-commerce Bot — Repository Agent Constitution

Canonical engineering rules for the **E-commerce Bot** monorepo. System overview lives in [docs/architecture.md](docs/architecture.md). Personal/domain skills live in the Obsidian canonical library (`mercadopago-expert`, `nuvemshop-expert`, `shopify-expert`, `backend`, `ui-ux`, `infra-agent`, `security-audit`).

## 1. Mandatory Code Navigation (Graft)

- Always use **Graft** (`graft map`, `graft ask`, `graft grep`, `graft callers`, `graft skeleton`) as the primary tool for symbol lookup, callers/callees, and blast-radius analysis before scanning files manually.
- After structural code changes or new files, run `graft build` to keep `graft/` fresh.

## 2. Fail-Closed Architectural & Security Invariants

1. **Multi-Tenant SQL Isolation:** Every Dapper query/command on tenant-scoped tables MUST include `WHERE TenantId = @TenantId` with typed parameters and honor `SESSION_CONTEXT(N'TenantId')` RLS.
2. **Worker Isolation (`EcommerceBot.Worker`):** Never import relational DB drivers (`sqlalchemy`, `pyodbc`, `psycopg*`, `asyncpg`, `pymssql`, `tortoise-orm`) or external LLM SDKs (`openai`, `anthropic`, `openrouter`, `langchain`). Communicate exclusively via RabbitMQ (`aio-pika`) and Redis; LLM orchestration lives strictly in `EcommerceBot.Core`.
3. **Zero Static Secret Fallbacks:** Never use `?? "default_secret"` for JWT, AES, internal service, or webhook keys. Throw `InvalidOperationException` or return `401` (fail-closed).
4. **No Privilege Escalation:** Self-service profile endpoints (`UpdateProfileAsync`) must never accept/mutate `Role`. New standard registrations default to `MEMBER` and must never accept an arbitrary `TenantId` without authorization/invite.
5. **No HTTP Route Collisions:** Never declare identical controller/action route paths in ASP.NET Core (`AmbiguousMatchException`).
6. **Constant-Time Webhook Verification:** Validate all webhook signatures (Mercado Pago, Shopify, Nuvemshop, Svix/Resend) exclusively with `CryptographicOperations.FixedTimeEquals` and Redis `SET NX` 24h idempotency (set only after durable processing/enqueue).
7. **Anti-SSRF:** Allow only `http://` and `https://`; block loopback, RFC 1918 private ranges, link-local/cloud metadata (`169.254.169.254`), `0.0.0.0`, IPv6 ULA/mapped loopback, and validate DNS + HTTP redirects.
8. **No Inline HTML in Emails:**
   - `EcommerceBot.Core`: Razor `.cshtml` in `src/EcommerceBot.Api/Views/Emails/` + ViewModel in `src/EcommerceBot.Application/ViewModels/Emails/` via `IRazorTemplateRenderer`.
   - `EcommerceBot.Worker`: Jinja2 `.html` in `app/templates/` with `autoescape=True`.
9. **Clean Bootstrapping (`Program.cs`):** Keep `Program.cs` strictly as pipeline orchestration; place DI/options/middleware setup in `Configurations/` and `Middlewares/`. Production runtime targets Workstation GC (`DOTNET_ServerGarbageCollection=0`, `DOTNET_GCHeapHardLimit=0x10000000`, `DOTNET_GCTrimCommit=1`) to protect the 6 GB VPS.
10. **Read-Only MCP Diagnostics (`EcommerceBot.Diagnostics.Mcp`):** Expose strictly read-only DMV (`WITH (NOLOCK)`), Redis, RabbitMQ, and log inspections without leaking secrets or running dynamic DML/DDL.

## 3. Monorepo Pillars & Conventions

- **`EcommerceBot.Core/` (.NET 9, C#):** Clean Architecture / DDD (`Domain -> Application -> Infrastructure -> Api`), Dapper + SQL Server 2022, MassTransit with `UseRawJsonSerializer()`, OpenRouter LLM orchestration, Mercado Pago / Shopify / Nuvemshop / Resend gateways, and Redis Pub/Sub SSE (`events:tenant:{tenantId}`).
- **`EcommerceBot.Worker/` (Python 3.13):** FastAPI + `aio-pika` async scraping (`Scrapling` + `Camoufox` + JSON-LD) and local `Scikit-Learn` inference (RFM, Churn, LTV, Capacity).
- **`Database.Migrations/` (.NET 8):** Deterministic DbUp SQL Server 2022 migrations (`RCSI` + `ALLOW_SNAPSHOT_ISOLATION ON`, `NEWSEQUENTIALID()`, `DATETIMEOFFSET`, `AES-256 GCM` columns, segregated `usr_ecommerce_deployer` vs `usr_ecommerce_api`).
- **`EcommerceBot.Web/` (React 19 + TypeScript + Vite 8 + Tailwind CSS v4):** Pure static SPA (no Node SSR runtime). Strict 4-layer isolation (`Types -> Services -> Hooks -> Components/Pages`): UI components and pages must never import `services/` or `apiClient` directly. Enforce `@/config/env`, WCAG 2.1 AA (`min-h-[44px]`, inputs `>= 16px`), and the ESLint `max-lines` ceiling of 350 lines per file (no `eslint-disable max-lines`).

## 4. Verification Commands

- **Core API:** `dotnet build EcommerceBot.Core/EcommerceBot.Core.sln` & `dotnet test EcommerceBot.Core/EcommerceBot.Core.sln`
- **Migrations:** `dotnet build Database.Migrations/Database.Migrations.csproj`
- **Frontend SPA:** `npm run lint && npm run build && npm test` (in `EcommerceBot.Web/`)
- **Python Worker:** `EcommerceBot.Worker\.venv\Scripts\pytest.exe -q` (in `EcommerceBot.Worker/`)
- **Context Graph:** `graft check` (or `graft build` after structural edits)
