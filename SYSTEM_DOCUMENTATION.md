# PulseCare — System Documentation

> **Clinical Resource Network · Real-Time Hospital Operations Management**
>
> Version: 2.0.0 · Stack: React 19 · Express 4 · Prisma 5 · SQLite · TypeScript · SSE

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Detailed Feature Breakdown](#2-detailed-feature-breakdown)
3. [Tech Stack & Dependencies](#3-tech-stack--dependencies)
4. [Data Flow & System Architecture](#4-data-flow--system-architecture)
5. [REST API Reference](#5-rest-api-reference)
6. [Database Schema Reference](#6-database-schema-reference)
7. [File & Directory Map](#7-file--directory-map)
8. [Environment Configuration](#8-environment-configuration)
9. [Developer Runbook](#9-developer-runbook)

---

## 1. Executive Overview

### What Is PulseCare?

PulseCare is a **real-time hospital clinical resource management system** designed for multi-hospital networks. It enables hospital coordinators, doctors, nurses, and administrators to monitor, request, and track critical medical resources — ICU Beds, Blood units, Ventilators, Oxygen cylinders, and Ambulances — across a network of partner hospitals, with immediate visibility into supply levels and the full lifecycle of every resource transfer request.

The system is built as a full-stack TypeScript application: a **React 19 SPA** frontend served by Vite, proxying all API traffic through to an **Express 4 REST API** backend backed by a **SQLite database** managed via **Prisma ORM**.

### Core Problem Statement

Hospital networks managing shared critical resources face three recurring operational failures:

| Problem | Real-World Impact |
|---|---|
| **Resource contention** | Two departments simultaneously approve allocation of the last 2 ICU beds, resulting in a double-booking and one patient without a bed |
| **Stale data and missed updates** | A coordinator approves a ventilator request without knowing another coordinator already allocated that unit 30 seconds earlier |
| **No accountability trail** | Cancelled or rejected resource requests leave no record — audits cannot reconstruct what happened, when, or who acted |

PulseCare addresses all three directly:

- **Contention** is eliminated by optimistic concurrency versioning, supply-check gating at approval, and atomic database transactions that roll back on failure.
- **Stale data** is eliminated by a Server-Sent Events (SSE) stream that pushes resource and transaction updates to every connected client within milliseconds of a state change.
- **Accountability** is enforced by an append-only `AuditLog` table written atomically inside every mutation transaction, capturing the complete before/after state with actor identity and timestamp.

### Scope

- **5 partner hospitals** in the seed dataset (expandable without schema changes)
- **5 resource types**: ICU Beds, Blood, Ventilators, Oxygen, Ambulances
- **4 transaction lifecycle states**: `requested → approved → in_transit → completed` (or `cancelled`)
- **3 user roles**: Doctor, Nurse, Hospital Admin (frontend auth only — stateless demo mode)
- **Real-time push**: Every connected browser tab receives live updates via SSE

---

## 2. Detailed Feature Breakdown

### 2.1 Real-Time Resource Status (SSE)

**Problem:** A polling-based frontend would show stale inventory counts. If Hospital A allocates 3 ICU beds, coordinators at Hospital B would not know until their next page refresh.

**Implementation:**

The backend maintains an in-process **SSE client registry** (`backend/src/services/eventBus.ts`). When any mutation route successfully commits a change to the database, it calls `eventBus.emit(event)`, which iterates every registered `Response` stream and writes the event payload.

```
Client opens EventSource → GET /api/events → server registers client → sends typed events on demand
```

The frontend `useEventStream` hook (`src/services/eventStream.ts`) opens a persistent `EventSource` connection and dispatches typed callbacks:

| SSE Event Type | Trigger | Frontend Action |
|---|---|---|
| `resource.updated` | Any quantity/status change | Merge updated resource into state (version-guarded) |
| `transaction.created` | New transaction POSTed | Prepend to transaction list if not already present |
| `transaction.status_changed` | Status PATCH committed | Replace matching transaction in state |
| `transaction.conflict` | Request rejected for insufficient supply | Show red conflict toast notification |
| `transaction.duplicate` | Idempotent replay blocked | (reserved for future UI treatment) |
| `ping` | Every 25 seconds | Keep-alive — no UI action |
| `connected` | On initial connection | Set `liveConnected = true`, reset retry back-off |

**Connection resilience:** The hook implements exponential back-off reconnection (2s minimum, 30s maximum). On successful reconnect the back-off counter resets.

**Live indicator:** A `LiveBadge` component in the top-right corner of the dashboard shows a pulsing green dot when the SSE stream is active, grey when disconnected.

**Out-of-order guard:** The frontend `mergeResource()` function compares the incoming event's `version` field against the currently held version. If the incoming version is older, the update is discarded — preventing a slow network from overwriting a fresher state.

```typescript
// src/App.tsx — version guard
function mergeResource(updated: Resource) {
  setResources(prev => {
    const idx = prev.findIndex(r => r.id === updated.id);
    if (prev[idx].version > updated.version) return prev; // discard stale event
    const next = [...prev];
    next[idx] = updated;
    return next;
  });
}
```

---

### 2.2 Concurrency Control & Conflict Detection

**Problem:** Two coordinators simultaneously approve the same resource allocation. Without locking, both writes succeed and inventory goes negative.

#### Optimistic Concurrency (Resource Updates)

Every `Resource` row carries a `version: Int` counter. The PATCH endpoint enforces a compare-and-swap check inside an ACID transaction:

```
Client reads resource   → notes version = 5
Client sends PATCH      → body includes { version: 5 }
Server opens transaction → reads current row → version is 7 (modified by another request)
Server returns 409      → "Your version=5, current version=7. Re-fetch and retry."
```

On a successful write, `version` is atomically incremented: `{ version: { increment: 1 } }`.

#### Supply Availability Check (Transaction Approval)

When `POST /api/transactions` is called, the route verifies supply inside the same transaction that creates the record:

```
resource.quantity < requested_quantity  →  409 Conflict
resource.quantity >= requested_quantity →  Transaction created (status: 'requested')
```

When a transaction moves `requested → approved`, the approval step atomically deducts from inventory:

```
new_quantity = resource.quantity - transaction.quantity
resource.status derived from (new_quantity / capacity) ratio:
  0%         → 'critical'
  0–20%      → 'critical'
  20–40%     → 'low'
  >40%       → 'available'
```

#### Cancellation Rollback

When any in-progress transaction (`approved` or `in_transit`) is cancelled, the previously deducted quantity is **atomically restored** to the resource, and `version` is incremented again:

```
cancelled (was approved) → resource.quantity += transaction.quantity
```

#### ACID Wrapping

All multi-step operations use `prisma.$transaction(async (tx) => { ... })`. If any step inside throws, Prisma rolls back all writes. This guarantees:

- Resource check + Transaction create = one atomic unit
- Status update + Inventory deduction/restoration + Audit log write = one atomic unit

---

### 2.3 Idempotency & Event Ordering

#### Idempotency Keys

Clients can supply an `Idempotency-Key` header on `POST /api/transactions`. The middleware (`backend/src/middleware/idempotency.ts`) caches the response for 24 hours using an in-process `Map`.

```
First request  (key: "uuid-abc") → executes handler → caches response → returns 201
Second request (key: "uuid-abc") → cache hit → replays cached 201 response, no DB write
```

- The cache is pruned hourly to remove expired entries.
- Keys with no TTL entry are treated as first-time requests.
- Responses from 5xx errors are **not** cached (only success and 4xx are idempotent).
- The `idempotencyKey` is stored in the `Transaction` row (`@unique`) as a permanent dedup guard at the database layer.

#### Logical Timestamps / Version Ordering

The `Resource.version` integer acts as a logical clock. It is:
- Incremented on every write to that row
- Included in every SSE `resource.updated` payload
- Checked by the frontend before applying a pushed update
- Sent by cooperative clients in PATCH request bodies to prevent stale writes

This ensures that even if two SSE messages arrive out of order (due to network jitter), the frontend always displays the freshest known state.

---

### 2.4 Transaction Management & Failure Recovery

#### ACID Transactions

Every state-changing operation in the API is wrapped in `prisma.$transaction()`. This provides:

| Property | How it's achieved |
|---|---|
| **Atomicity** | All writes in the lambda commit together or roll back entirely |
| **Consistency** | FK constraints, `@@unique` constraints, and business rules enforced before commit |
| **Isolation** | SQLite serialises writes; concurrent readers see committed state only |
| **Durability** | SQLite WAL mode ensures committed transactions survive process restarts |

#### Failure Scenarios and Recovery

| Scenario | Behaviour |
|---|---|
| Supply check fails inside transaction | Rolls back; writes conflict `AuditLog` entry; returns 409 |
| Audit log write fails inside transaction | Rolls back entire transaction; neither resource nor transaction is modified |
| Network timeout after client sends POST | Client retries with same `Idempotency-Key`; server replays cached response; no duplicate created |
| Backend crashes mid-approval | SQLite rolls back uncommitted transaction on next startup; resource quantity unchanged |
| EADDRINUSE on startup | Server prints actionable error and exits with code 1 instead of crashing with unhandled exception |

#### State Machine Enforcement

Transaction status transitions are enforced server-side. Invalid transitions return `422 Unprocessable Entity`:

```
┌───────────┐    approve     ┌──────────┐    dispatch    ┌───────────┐    complete    ┌───────────┐
│ requested ├───────────────►│ approved ├───────────────►│ in_transit├───────────────►│ completed │
└─────┬─────┘                └────┬─────┘                └─────┬─────┘                └───────────┘
      │                           │                            │
      │   cancel                  │   cancel                   │   cancel
      ▼                           ▼                            ▼
┌───────────┐              ┌───────────┐               ┌───────────┐
│ cancelled │              │ cancelled │               │ cancelled │
└───────────┘              └───────────┘               └───────────┘

completed → (terminal, no further transitions)
cancelled → (terminal, no further transitions)
```

---

### 2.5 Append-Only Audit Trail

Every mutation in the system writes an `AuditLog` record **inside the same database transaction**. This guarantees the audit log is never out of sync with the data it describes.

#### AuditLog Record Structure

| Field | Type | Description |
|---|---|---|
| `id` | `cuid()` | Unique auto-generated identifier |
| `actionType` | `String` | One of five action type constants (see below) |
| `performedBy` | `String` | User ID from `X-User-ID` request header |
| `resourceId` | `String?` | FK to affected Resource (nullable) |
| `transactionId` | `String?` | FK to affected Transaction (nullable) |
| `hospitalId` | `String?` | FK to affected Hospital (nullable) |
| `previousState` | `String` | JSON snapshot of the record before the change |
| `newState` | `String` | JSON snapshot of the record after the change |
| `reason` | `String` | Human-readable explanation |
| `metadata` | `String` | JSON with `correlationId`, IP, idempotency key, etc. |
| `createdAt` | `DateTime` | Immutable creation timestamp |

#### Action Types

| Action Type | When Written |
|---|---|
| `RESOURCE_UPDATED` | Direct quantity/status change via PATCH /api/resources/:id |
| `TXN_CREATED` | New transaction successfully created via POST /api/transactions |
| `TXN_STATUS_CHANGED` | Transaction moved through workflow via PATCH /api/transactions/:id/status |
| `TXN_CONFLICT` | Request rejected because supply < requested quantity |
| `TXN_DUPLICATE` | Idempotency key replay blocked (reserved, for future use) |

The `AuditLog` table has 5 indexes (`resourceId`, `transactionId`, `performedBy`, `actionType`, `createdAt`) enabling efficient queries across all forensic access patterns.

---

### 2.6 Authentication Gate (Frontend Demo)

A two-step login modal gates access to the entire dashboard. Auth is entirely frontend-local — no backend calls, no user table in the database.

**Step 1 — Role + Credential:**
- User selects role: `Doctor`, `Nurse`, or `Hospital Admin`
- Enters any Mobile Number or Staff ID (min 4 characters)
- Clicks **Send OTP**

**Step 2 — OTP Verification:**
- A fixed demo OTP (`123456`) is displayed in an amber hint badge
- Six individual digit-box input with paste support, backspace navigation, and keyboard arrow navigation
- On correct entry, `AuthUser` is written to `localStorage` under key `pulsecare_auth`
- `AuthProvider` reads `localStorage` on mount — session survives page refresh

**Instant demo bypass:** A **"Skip — Instant Demo Login (Doctor)"** button at the bottom of the login screen logs in as `Dr. demo-user` in one click.

**Logout:** Two-tap confirmation in the sidebar (first tap shows red "Tap again to confirm", auto-resets after 3 seconds).

The `X-User-ID` request header is populated from the stored `AuthUser.id` on every API call, which flows into `Transaction.performedBy` and `AuditLog.performedBy`.

---

## 3. Tech Stack & Dependencies

### 3.1 Frontend

| Category | Technology | Version | Role |
|---|---|---|---|
| Framework | React | `^19.2.8` | UI component tree and state management |
| Build tool | Vite | `^8.2.0` | Dev server with HMR, production bundler, dev proxy |
| Language | TypeScript | `~6.0.2` | Static typing across entire frontend codebase |
| Styling | Tailwind CSS v4 | `^4.3.3` | Utility-first CSS via Vite plugin (no PostCSS config needed) |
| Routing | None (SPA state) | — | Page navigation handled by `useState<Page>` in App.tsx |
| State management | React built-ins | — | `useState`, `useEffect`, `useCallback`, `useRef`, Context API |
| Real-time client | Native `EventSource` | Browser API | SSE stream via `useEventStream` custom hook |
| Auth | `localStorage` + Context | — | `AuthProvider` / `useAuth` — no external auth library |
| HTTP client | Native `fetch` | Browser API | `src/services/api.ts` typed wrapper |
| Linter | oxlint | `^1.75.0` | Fast Rust-based linter |

**Frontend TypeScript Compiler (`tsconfig.app.json`):**
- `target: ES2020`, `module: ESNext`, `moduleResolution: bundler`
- `jsx: react-jsx`, `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`

### 3.2 Backend

| Category | Technology | Version | Role |
|---|---|---|---|
| Runtime | Node.js | v24.x | JavaScript server runtime |
| Language | TypeScript | `~5.5.4` | Static typing, compiled to CommonJS |
| Hot-reload dev runner | tsx (watch) | `^4.16.2` | TypeScript execution with watch mode — no separate compile step in dev |
| HTTP framework | Express | `^4.19.2` | REST routing, middleware chaining |
| CORS | cors | `^2.8.5` | Cross-origin request headers with origin whitelist |
| Environment | dotenv | `^16.4.5` | `.env` file loading via `import 'dotenv/config'` |
| Real-time server | Native Node.js `Response` streams | — | SSE via `text/event-stream` — no socket.io dependency |
| Idempotency | Custom in-process middleware | — | `Map<string, CachedResponse>` with 24h TTL |
| Request logging | Custom middleware | — | Correlation ID + structured JSON logs on `res.finish` |
| Error handling | Custom middleware | — | Centralised `{ error, details? }` JSON envelope, last in chain |

**Backend TypeScript Compiler (`backend/tsconfig.json`):**
- `target: ES2022`, `module: CommonJS`, `moduleResolution: node`
- `outDir: ./dist`, `rootDir: ./src`, `strict: true`, `sourceMap: true`

### 3.3 Database & ORM

| Category | Technology | Version | Role |
|---|---|---|---|
| Database (dev) | SQLite | Built-in via Prisma | Zero-install file-based DB (`prisma/dev.db`) |
| Database (prod) | PostgreSQL (recommended) | — | Change `provider = "postgresql"` in schema — no code changes required |
| ORM | Prisma | `^5.16.1` (engine: 5.22.0) | Schema-first ORM with typed client, migrations, Prisma Studio |
| Prisma Client | `@prisma/client` | `^5.16.1` | Generated typed DB client, singleton in `backend/src/db.ts` |
| Caching / Locking | In-process `Map` | — | Idempotency cache. Production upgrade path: Redis `SETEX` |
| Connection | Singleton `PrismaClient` | — | Single instance reused across all modules (safe for SQLite single-writer) |

**Prisma Models:** `Hospital`, `Resource`, `Transaction`, `AuditLog` (4 models, 2 migrations)

### 3.4 DevOps & Tooling

| Tool | Version | Role |
|---|---|---|
| `concurrently` | `^9.2.4` | Runs backend and frontend in one terminal with colour-coded labels |
| `kill-port` | `^2.0.1` | `predev` hook kills processes on ports 3001, 3000, 5173 before startup |
| Vite dev proxy | Built into Vite | Forwards `/api/*` and `/health` from `:5173` to `:3001` — eliminates CORS in dev |
| Prisma Migrate | Included in prisma CLI | Schema versioning via SQL migration files in `backend/prisma/migrations/` |
| Prisma Studio | Included in prisma CLI | Browser-based DB GUI — `npm run db:studio` from `backend/` |
| Prisma Seed | `tsx prisma/seed.ts` | Seeds 5 hospitals, 25 resources, 6 transactions — idempotent (clears first) |

---

## 4. Data Flow & System Architecture

### 4.1 System Topology

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (port 5173)                    │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              React SPA (Vite)                       │ │
│  │                                                     │ │
│  │  AuthContext ──► LoginModal (localStorage gate)     │ │
│  │                                                     │ │
│  │  App.tsx                                            │ │
│  │   ├── Dashboard.tsx  (summary cards, alerts)        │ │
│  │   ├── Resources.tsx  (filterable resource grid)     │ │
│  │   ├── Transactions.tsx (status workflow board)      │ │
│  │   ├── RequestModal.tsx (resource request form)      │ │
│  │   └── Sidebar.tsx   (nav + user profile + logout)   │ │
│  │                                                     │ │
│  │  services/api.ts ──── fetch() ──────────────────────┼─┼──► /api/*
│  │  services/eventStream.ts ── EventSource ────────────┼─┼──► /api/events
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
          │ All /api and /health requests proxied by Vite
          ▼
┌──────────────────────────────────────────────────────────┐
│                Express Server (port 3001)                  │
│                                                           │
│  Middleware chain (in order):                             │
│   1. cors()           — origin whitelist                  │
│   2. express.json()   — body parsing                      │
│   3. requestLogger()  — correlation ID + structured log   │
│   4. idempotency()    — dedup cache (on mutating routes)  │
│                                                           │
│  Routes:                                                  │
│   GET  /health              ── health + cache metrics     │
│   *    /api/hospitals       ── hospitalsRouter            │
│   *    /api/resources       ── resourcesRouter            │
│   *    /api/transactions    ── transactionsRouter         │
│   GET  /api/events          ── eventsRouter (SSE)         │
│   *    /api/audit           ── auditRouter                │
│                                                           │
│   errorHandler()   — centralised JSON error envelope      │
│                                                           │
│  Services:                                                │
│   eventBus.ts  — SSE client registry + typed emitter     │
└──────────────────────────────────────────────────────────┘
          │
          ▼ Prisma Client (singleton)
┌──────────────────────────────────────────────────────────┐
│                SQLite Database (dev.db)                   │
│                                                           │
│  Tables: Hospital, Resource, Transaction, AuditLog        │
└──────────────────────────────────────────────────────────┘
```

---

### 4.2 Resource Allocation Request — Complete Data Flow

The following traces a coordinator submitting a new resource request through to broadcast:

```
Step 1 — UI Form Submit
  RequestModal.tsx
    └── handleSubmit() called with { resourceId, resourceType, hospitalId, quantity, urgency, ... }
    └── calls createTransaction(payload) from services/api.ts

Step 2 — API Call Construction
  services/api.ts :: createTransaction()
    └── fetch('POST', '/api/transactions', body)
        Headers: {
          Content-Type:    application/json
          X-User-ID:       "<user id from localStorage>"
          Idempotency-Key: "<optional UUID>"    ← if supplied by caller
        }

Step 3 — Vite Proxy
  vite.config.ts proxy rule: /api → http://localhost:3001
    └── Browser sees origin :5173, proxy rewrites to :3001
    └── changeOrigin: true prevents CORS preflight rejection

Step 4 — Express Middleware Chain
  cors()          — validates origin against allowedOrigins whitelist
  express.json()  — parses JSON body
  requestLogger() — generates correlationId, attaches to req.correlationId
                    echoes X-Correlation-ID response header
  idempotency()   — checks Map<idempotencyKey, CachedResponse>
                    if cache hit → replay cached response (skip handler)
                    if miss → intercept res.json to cache on completion

Step 5 — Route Handler: POST /api/transactions
  transactions.ts
    └── Validate required fields (400 if missing)
    └── Validate resourceType, urgency enums (400 if invalid)
    └── Validate quantity > 0 (400 if not)

Step 6 — ACID Transaction
  prisma.$transaction(async (tx) => {
    ├── tx.resource.findUnique(resourceId)      ← read with isolation
    ├── tx.hospital.findUnique(hospitalId)       ← verify references
    │
    ├── if resource.quantity < quantity:
    │     tx.auditLog.create({ actionType: 'TXN_CONFLICT', ... })
    │     throw 409 Conflict                     ← full rollback
    │
    ├── tx.transaction.create({
    │     status: 'requested',
    │     idempotencyKey,
    │     performedBy: req.userId,
    │     ...
    │   })
    │
    └── tx.auditLog.create({
          actionType:    'TXN_CREATED',
          previousState: '',
          newState:      JSON.stringify({ status: 'requested', quantity }),
          metadata:      JSON.stringify({ correlationId }),
          ...
        })
  })                                             ← commit atomically

Step 7 — SSE Broadcast
  eventBus.emit({
    type:      'transaction.created',
    payload:   newTransaction,
    timestamp: ISO string,
    actor:     userId,
  })
    └── iterates Map<clientId, Response>
    └── writes: "event: transaction.created\ndata: {...}\n\n"
    └── dead clients removed automatically on write failure

Step 8 — HTTP Response
  res.status(201).json({ data: transaction })
    └── idempotency middleware caches this response
    └── Correlation-ID header set on response

Step 9 — Frontend State Update
  App.tsx :: handleSubmit()
    └── receives created transaction from API response
    └── setTransactions(prev => [created, ...prev])   ← optimistic prepend
    └── setModalOpen(false)

  useEventStream :: onTransactionCreated callback
    └── SSE event arrives (possibly ms later)
    └── deduplicated: if already in state (same id), skip
    └── otherwise prepend to transaction list

Step 10 — All Other Connected Clients
  Every other open browser tab receives the SSE event
  and sees the new transaction appear in real-time
  without refreshing.
```

---

### 4.3 Transaction Status Advancement Flow (Approval → Inventory Deduction)

```
PATCH /api/transactions/:id/status  { status: 'approved' }

prisma.$transaction(async (tx) => {
  ├── tx.transaction.findUnique(id)          ← get current record
  ├── State machine check:
  │     currentStatus = 'requested'
  │     ALLOWED_TRANSITIONS['requested'] = ['approved', 'cancelled']
  │     'approved' is allowed → proceed
  │
  ├── tx.resource.findUnique(resourceId)     ← re-check supply
  ├── if resource.quantity < txn.quantity → throw 409
  │
  ├── tx.resource.update({
  │     quantity: resource.quantity - txn.quantity,
  │     status:   derived from ratio,        ← auto-computed
  │     version:  { increment: 1 },          ← optimistic lock bump
  │   })
  │
  ├── tx.transaction.update({
  │     status:         'approved',
  │     previousStatus: 'requested',
  │     performedBy:    req.userId,
  │   })
  │
  └── tx.auditLog.create({
        actionType:    'TXN_STATUS_CHANGED',
        previousState: '{"status":"requested"}',
        newState:      '{"status":"approved"}',
        ...
      })
})

→ eventBus.emit('resource.updated', updatedResource)
→ eventBus.emit('transaction.status_changed', updatedTransaction)
→ All clients see both the resource quantity drop and the transaction status advance
```

---

## 5. REST API Reference

**Base URL:** `http://localhost:3001` (direct) or `/` (via Vite proxy)

**Standard Response Envelope:**
```json
// Success
{ "data": <payload> }

// Error
{ "error": "<message>", "details": "<stack — dev mode only>" }

// List with pagination (audit log)
{ "data": [...], "meta": { "total": 42, "limit": 100, "offset": 0 } }
```

**Common Request Headers:**

| Header | Required | Description |
|---|---|---|
| `Content-Type` | Yes (mutations) | Must be `application/json` |
| `X-User-ID` | Recommended | User ID written into audit logs and `performedBy` |
| `Idempotency-Key` | Optional | UUID string for exactly-once POST semantics |
| `X-Correlation-ID` | Optional | Client-supplied trace ID; echoed in response |

---

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Server health + idempotency cache size |

---

### Hospitals

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/hospitals` | All hospitals, sorted A→Z by name |
| `GET` | `/api/hospitals/:id` | Single hospital by ID; 404 if not found |

---

### Resources

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/resources` | All resources. Optional: `?type=`, `?status=`, `?hospitalId=` (combinable) |
| `GET` | `/api/resources/:id` | Single resource; 404 if not found |
| `PATCH` | `/api/resources/:id` | Update `quantity` and/or `status`. Body: `{ quantity?, status?, version?, reason? }` |

**PATCH concurrency protocol:** Send `version` (read from the resource) in the body. Returns `409` if the server's version differs.

**Valid `type` values:** `ICU Beds`, `Blood`, `Ventilators`, `Oxygen`, `Ambulances`

**Valid `status` values:** `available`, `low`, `critical`

---

### Transactions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/transactions` | All transactions, newest first. Optional: `?status=` |
| `POST` | `/api/transactions` | Create a new transaction (status auto-set to `requested`) |
| `PATCH` | `/api/transactions/:id/status` | Advance/revert status per state machine. Body: `{ status, reason? }` |

**POST body:**
```json
{
  "resourceId":   "r2",
  "resourceType": "ICU Beds",
  "hospitalId":   "h2",
  "hospitalName": "Apollo Hospitals",
  "quantity":     2,
  "urgency":      "urgent",
  "unit":         "beds",
  "note":         "Patient from road accident"
}
```

**Valid `urgency` values:** `routine`, `urgent`, `emergency`

**Valid `status` transition values:** `approved`, `in_transit`, `completed`, `cancelled`

---

### Events (SSE)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/events` | Open SSE stream. Heartbeat every 25 seconds. |

```javascript
// Client connection example
const es = new EventSource('/api/events', { withCredentials: true });
es.addEventListener('resource.updated', (e) => console.log(JSON.parse(e.data)));
es.addEventListener('transaction.created', (e) => console.log(JSON.parse(e.data)));
```

---

### Audit Log

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/audit` | Paginated audit entries. See query params below. |
| `GET` | `/api/audit/:id` | Single audit entry by ID |

**Query params:** `resourceId`, `transactionId`, `hospitalId`, `performedBy`, `actionType`, `from` (ISO), `to` (ISO), `limit` (max 500, default 100), `offset`

---

## 6. Database Schema Reference

### Prisma Models

#### `Hospital`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id` | Manual assignment (e.g. `"h1"`) |
| `name` | `String` | | Hospital display name |
| `location` | `String` | | City, State |
| `contact` | `String` | | Phone number |
| `type` | `String` | | `"Central Government"`, `"Government"`, `"Private"` |
| `resources` | `Resource[]` | relation | One-to-many |
| `transactions` | `Transaction[]` | relation | One-to-many |
| `auditLogs` | `AuditLog[]` | relation | One-to-many |
| `createdAt` | `DateTime` | `@default(now())` | |
| `updatedAt` | `DateTime` | `@updatedAt` | |

#### `Resource`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id` | Manual assignment (e.g. `"r1"`) |
| `type` | `String` | `@@unique([hospitalId, type])` | Resource type string |
| `hospitalId` | `String` | FK | Reference to owning Hospital |
| `quantity` | `Int` | | Current available quantity |
| `capacity` | `Int` | `@default(0)` | Ceiling; `0` = uncapped |
| `status` | `String` | | `available`, `low`, `critical` |
| `unit` | `String` | | `beds`, `units`, `cylinders` |
| `version` | `Int` | `@default(0)` | Optimistic concurrency counter |
| `lastUpdated` | `DateTime` | `@updatedAt` | Auto-refreshed on every write |
| `createdAt` | `DateTime` | `@default(now())` | |

#### `Transaction`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id` | Format: `TXN-YYYYMMDD-XXXXX` |
| `resourceId` | `String` | FK | Reference to Resource |
| `resourceType` | `String` | | Denormalised resource type |
| `hospitalId` | `String` | FK | Reference to Hospital |
| `hospitalName` | `String` | | Denormalised hospital name |
| `quantity` | `Int` | | Units requested |
| `urgency` | `String` | | `routine`, `urgent`, `emergency` |
| `note` | `String` | `@default("")` | Optional free text |
| `status` | `String` | | Workflow status |
| `previousStatus` | `String` | `@default("")` | Status before last transition |
| `unit` | `String` | | Unit label |
| `idempotencyKey` | `String?` | `@unique` | Client dedup key; null = no dedup |
| `performedBy` | `String` | `@default("system")` | User ID of last actor |
| `createdAt` | `DateTime` | `@default(now())` | |
| `updatedAt` | `DateTime` | `@updatedAt` | |

#### `AuditLog`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id @default(cuid())` | Auto-generated CUID |
| `actionType` | `String` | `@@index` | One of 5 action type constants |
| `performedBy` | `String` | `@@index` | User ID |
| `resourceId` | `String?` | FK, `@@index` | Nullable resource reference |
| `transactionId` | `String?` | FK, `@@index` | Nullable transaction reference |
| `hospitalId` | `String?` | FK | Nullable hospital reference |
| `previousState` | `String` | `@default("")` | JSON snapshot before change |
| `newState` | `String` | `@default("")` | JSON snapshot after change |
| `reason` | `String` | `@default("")` | Human-readable explanation |
| `metadata` | `String` | `@default("")` | JSON: correlationId, IP, etc. |
| `createdAt` | `DateTime` | `@@index` | Immutable write timestamp |

> **Append-only contract:** No `UPDATE` or `DELETE` operations are ever issued against `AuditLog`. The table grows monotonically.

---

### Seeded Data

The seed script (`backend/prisma/seed.ts`) populates:

| Entity | Count | Details |
|---|---|---|
| Hospitals | 5 | AIIMS Delhi, Apollo Hospitals, Fortis Escorts, KEM Hospital, Narayana Health |
| Resources | 25 | 5 hospitals × 5 resource types (ICU Beds, Blood, Ventilators, Oxygen, Ambulances) |
| Transactions | 6 | Covering all status values: requested, approved, in_transit, completed |

The seed is idempotent: it clears all existing data (in FK-safe order) before inserting fresh records.

---

## 7. File & Directory Map

```
HOSPITAL1/                              ← project root
│
├── package.json                        ← root scripts: dev, build, lint, predev
├── vite.config.ts                      ← Vite plugins + dev proxy rules (/api → :3001)
├── tsconfig.json                       ← root TS config (references app config)
├── tsconfig.app.json                   ← frontend TS compiler options
├── tsconfig.node.json                  ← node-side TS config (vite config itself)
├── index.html                          ← SPA entry point — mounts <div id="root">
├── .env                                ← VITE_API_BASE_URL (empty = use proxy)
├── .gitignore                          ← excludes: node_modules, dist, .env, dev.db
├── SYSTEM_DOCUMENTATION.md            ← this file
│
├── public/
│   ├── favicon.svg
│   └── icons.svg
│
├── src/                                ← FRONTEND SOURCE
│   ├── main.tsx                        ← React root: wraps <App> in <AuthProvider>
│   ├── App.tsx                         ← Auth gate + authenticated shell + SSE subscription
│   ├── index.css                       ← Tailwind base styles + custom CSS variables
│   │
│   ├── types/
│   │   └── index.ts                    ← All shared TypeScript types and interfaces
│   │                                     (AuthUser, Hospital, Resource, Transaction,
│   │                                      AuditLog, PulseCareEvent, SSE event types)
│   │
│   ├── context/
│   │   └── AuthContext.tsx             ← AuthProvider + useAuth hook
│   │                                     localStorage persistence, login/logout
│   │
│   ├── services/
│   │   ├── api.ts                      ← All fetch wrappers (hospitals, resources,
│   │   │                                 transactions, audit log) — relative paths
│   │   └── eventStream.ts             ← useEventStream hook — EventSource client
│   │                                     with typed callbacks + exponential back-off
│   │
│   ├── components/
│   │   ├── LoginModal.tsx             ← Two-step auth gate: role picker → OTP entry
│   │   │                                Demo OTP hint badge, digit-box input, instant bypass
│   │   ├── Sidebar.tsx                ← Navigation, dynamic user avatar + role badge,
│   │   │                                two-tap logout confirmation
│   │   ├── Dashboard.tsx              ← KPI summary cards, resource availability chart,
│   │   │                                active transactions panel, critical alerts grid
│   │   ├── Resources.tsx              ← Filterable resource grid (type, status, hospital, search)
│   │   ├── ResourceCard.tsx           ← Individual resource tile with status badge + Request button
│   │   ├── Transactions.tsx           ← Transaction list with status filter tabs +
│   │   │                                Approve/Dispatch/Complete/Back action buttons
│   │   └── RequestModal.tsx           ← Resource request form: type, hospital, qty,
│   │                                     urgency selector, note field
│   │
│   ├── assets/
│   │   └── hero.png
│   │
│   └── data/
│       └── mockData.ts                ← Fallback static data (used during dev if
│                                         backend is unreachable); types kept in sync
│
├── backend/                            ← BACKEND SOURCE
│   ├── package.json                    ← backend scripts: dev, build, start, db:*
│   ├── tsconfig.json                   ← CommonJS target, rootDir: ./src
│   ├── .env                            ← PORT=3001, DATABASE_URL, FRONTEND_URL
│   ├── .env.example                    ← committed template for .env
│   │
│   ├── prisma/
│   │   ├── schema.prisma               ← Prisma schema: Hospital, Resource,
│   │   │                                 Transaction, AuditLog models + migrations
│   │   ├── dev.db                      ← SQLite database file (gitignored)
│   │   ├── seed.ts                     ← Seeds 5 hospitals, 25 resources, 6 transactions
│   │   └── migrations/
│   │       ├── 20260825022855_init/    ← Initial schema migration
│   │       └── 20260825052016_phase2_concurrency_audit/  ← Phase 2 additions
│   │
│   ├── src/
│   │   ├── index.ts                    ← Express app entry: middleware chain, routes,
│   │   │                                 CORS origin list, EADDRINUSE handler
│   │   ├── db.ts                       ← Prisma singleton (one client for all modules)
│   │   │
│   │   ├── routes/
│   │   │   ├── hospitals.ts            ← GET /api/hospitals, GET /api/hospitals/:id
│   │   │   ├── resources.ts            ← GET / GET/:id / PATCH/:id
│   │   │   │                             Optimistic locking, ACID txn, audit, SSE
│   │   │   ├── transactions.ts         ← GET / POST / PATCH/:id/status
│   │   │   │                             State machine, inventory deduction, idempotency,
│   │   │   │                             conflict detection, audit, SSE
│   │   │   ├── events.ts               ← GET /api/events — SSE stream, 25s heartbeat
│   │   │   └── audit.ts                ← GET /api/audit (filtered, paginated)
│   │   │                                 GET /api/audit/:id
│   │   │
│   │   ├── services/
│   │   │   └── eventBus.ts             ← SSE client registry (Map<id, Response>)
│   │   │                                 emit(), ping(), addClient(), removeClient()
│   │   │
│   │   └── middleware/
│   │       ├── errorHandler.ts         ← Centralised error middleware: { error, details? }
│   │       │                             AppError interface, createError() factory
│   │       ├── idempotency.ts          ← In-memory Map cache, 24h TTL, hourly pruning
│   │       │                             Intercepts res.json to cache response body
│   │       └── requestLogger.ts        ← correlationId generation, X-User-ID extraction,
│   │                                     structured JSON logs on res.finish
│   │
│   └── node_modules/                   ← (gitignored)
│
├── dist/                               ← (gitignored) Vite production build output
└── node_modules/                       ← (gitignored) root dependencies
```

---

## 8. Environment Configuration

### Root `.env` (frontend, read by Vite)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `""` (empty) | Base URL prefix for all API calls. Empty = use Vite proxy (local dev). Set to full URL (e.g. `https://api.pulsecare.io`) for deployed environments. |

### `backend/.env`

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Express server listen port |
| `DATABASE_URL` | `file:./prisma/dev.db` | Prisma connection string. Change to `postgresql://...` for production. |
| `FRONTEND_URL` | `http://localhost:5173` | Primary origin for CORS whitelist |
| `NODE_ENV` | (unset) | Set to `production` to disable query logging and stack traces in errors |

---

## 9. Developer Runbook

### Prerequisites

- Node.js ≥ 18 (v24 recommended)
- npm ≥ 10

### First-Time Setup (fresh clone)

```bash
# 1. Install root dependencies (React, Vite, concurrently, kill-port, etc.)
npm install

# 2. Install backend dependencies (Express, Prisma, tsx, etc.)
cd backend && npm install

# 3. Apply database migrations (creates backend/prisma/dev.db)
npm run db:migrate

# 4. Seed the database with hospitals, resources, and transactions
npm run db:seed

# 5. Return to root and start both servers
cd ..
npm run dev
```

### Daily Development

```bash
# Start both servers in one terminal (backend :3001 + frontend :5173)
npm run dev
```

The `predev` hook automatically kills anything running on ports 3001, 3000, and 5173 before starting. No manual `kill-port` needed.

### Available Root Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `concurrently "dev:backend" "dev:frontend"` | Start both servers with colour labels |
| `npm run dev:backend` | `npm run dev --prefix backend` | Backend only (tsx watch) |
| `npm run dev:frontend` | `vite` | Frontend only (Vite HMR) |
| `npm run build` | `tsc -b && vite build` | Production TypeScript compile + Vite bundle |
| `npm run lint` | `oxlint` | Lint all source files |
| `npm run preview` | `vite preview` | Serve production `dist/` locally |

### Available Backend Scripts (run from `backend/`)

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `tsx watch src/index.ts` | Hot-reload development server |
| `npm run build` | `tsc` | Compile TypeScript to `dist/` |
| `npm run start` | `node dist/index.js` | Run compiled production server |
| `npm run db:migrate` | `prisma migrate dev` | Apply pending schema migrations |
| `npm run db:seed` | `tsx prisma/seed.ts` | Wipe and re-seed the database |
| `npm run db:reset` | `prisma migrate reset --force` | Drop all tables and re-run all migrations |
| `npm run db:studio` | `prisma studio` | Open Prisma Studio DB browser at :5555 |

### Port Reference

| Service | Port | URL |
|---|---|---|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend (Express) | 3001 | http://localhost:3001 |
| Prisma Studio | 5555 | http://localhost:5555 |

### Manually Testing the API

```bash
# Health check
curl http://localhost:3001/health

# All hospitals
curl http://localhost:3001/api/hospitals

# Critical resources
curl "http://localhost:3001/api/resources?status=critical"

# All transactions
curl http://localhost:3001/api/transactions

# Audit log (last 10 entries)
curl "http://localhost:3001/api/audit?limit=10"

# Create a transaction (with idempotency key)
curl -X POST http://localhost:3001/api/transactions \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-key-001" \
  -H "X-User-ID: DR-0042" \
  -d '{"resourceId":"r1","resourceType":"ICU Beds","hospitalId":"h1","hospitalName":"AIIMS Delhi","quantity":2,"urgency":"urgent","unit":"beds"}'

# Approve a transaction
curl -X PATCH http://localhost:3001/api/transactions/TXN-20260824-001/status \
  -H "Content-Type: application/json" \
  -H "X-User-ID: ADMIN-001" \
  -d '{"status":"approved","reason":"Approved by duty administrator"}'
```

### Upgrading to PostgreSQL

1. Update `backend/.env`:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/pulsecare"
   ```
2. Update `backend/prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Run migrations:
   ```bash
   cd backend && npm run db:migrate
   npm run db:seed
   ```

No application code changes required — Prisma abstracts the provider difference entirely.

---

*Document generated from live codebase audit · PulseCare v2.0.0*
