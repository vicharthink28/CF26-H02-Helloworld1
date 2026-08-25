# PulseCare Backend — Implementation Tasks

## Task 1 — Scaffold the backend directory & package.json

- [ ] Create `backend/` directory at the workspace root
- [ ] Create `backend/package.json` with:
  - `express@^4.19.2`, `cors@^2.8.5`, `dotenv@^16.4.5`
  - `@prisma/client@^5.16.1`, `prisma@^5.16.1` (dev)
  - `tsx@^4.16.2`, `typescript@~5.5.4`, `@types/express`, `@types/cors`, `@types/node` (dev)
  - Scripts: `dev` (tsx watch src/index.ts), `build` (tsc), `start` (node dist/index.js),
    `db:migrate` (prisma migrate dev), `db:seed` (tsx prisma/seed.ts),
    `db:reset` (prisma migrate reset --force)
- [ ] Create `backend/tsconfig.json` targeting ES2022 with `moduleResolution: bundler`

**Acceptance:** `cd backend && npm install` completes without errors.

---

## Task 2 — Define the Prisma schema & run the initial migration

- [ ] Create `backend/prisma/schema.prisma` with Hospital, Resource, and Transaction models
      as specified in design.md
- [ ] Create `backend/.env` from `.env.example` (DATABASE_URL pointing to `file:./prisma/dev.db`)
- [ ] Run `npx prisma migrate dev --name init` from the `backend/` directory
- [ ] Verify `backend/prisma/dev.db` is created

**Acceptance:** `npx prisma studio` opens and shows the three empty tables.

---

## Task 3 — Write and run the seed script

- [ ] Create `backend/prisma/seed.ts`
- [ ] Seed exactly the 5 hospitals from `mockData.ts`
- [ ] Seed exactly the 25 resources from `mockData.ts`
- [ ] Seed exactly the 6 transactions from `mockData.ts`
- [ ] Use `prisma.$transaction([...])` for atomic seeding
- [ ] Run `npm run db:seed`

**Acceptance:** All 36 records appear in Prisma Studio after seeding.

---

## Task 4 — Implement the Express application skeleton

- [ ] Create `backend/src/db.ts` — exports a singleton PrismaClient
- [ ] Create `backend/src/middleware/errorHandler.ts` — catches unhandled errors,
      returns `{ error: message }` with appropriate HTTP status
- [ ] Create `backend/src/index.ts`:
  - Load `.env` via `dotenv/config`
  - Mount `cors`, `express.json()`
  - Mount routes at `/api/hospitals`, `/api/resources`, `/api/transactions`
  - Mount `GET /health`
  - Mount error handler last
  - Listen on `process.env.PORT ?? 3001`

**Acceptance:** `npm run dev` starts without errors; `GET http://localhost:3001/health`
returns `{ "data": { "status": "ok" } }`.

---

## Task 5 — Hospitals routes

- [ ] Create `backend/src/routes/hospitals.ts`
- [ ] `GET /api/hospitals` — return all hospitals ordered by name
- [ ] `GET /api/hospitals/:id` — return single hospital or 404

**Acceptance:** `GET /api/hospitals` returns an array of 5 hospital objects matching the
mock data shape `{ id, name, location, contact, type }`.

---

## Task 6 — Resources routes

- [ ] Create `backend/src/routes/resources.ts`
- [ ] `GET /api/resources` — return all resources; support `?type`, `?status`, `?hospitalId`
      query params (each optional, combinable)
- [ ] `GET /api/resources/:id` — return single resource or 404
- [ ] `PATCH /api/resources/:id` — accept `{ quantity?, status? }`, update and return
      the updated resource; reject unknown status values with 400

**Acceptance:**
- `GET /api/resources?status=critical` returns 5 resources.
- `PATCH /api/resources/r1` with `{ "quantity": 5, "status": "low" }` returns the
  updated record with `lastUpdated` refreshed.

---

## Task 7 — Transactions routes

- [ ] Create `backend/src/routes/transactions.ts`
- [ ] `GET /api/transactions` — return all transactions ordered by `createdAt` desc;
      support `?status` filter
- [ ] `POST /api/transactions` — validate required fields (`resourceId`, `resourceType`,
      `hospitalId`, `hospitalName`, `quantity`, `urgency`, `unit`); auto-assign `id`
      (format: `TXN-YYYYMMDD-XXXXX`), `status: "requested"`, `createdAt: now()`
- [ ] `PATCH /api/transactions/:id/status` — validate the status value; update and return
      the transaction; return 404 if not found

**Acceptance:**
- `POST /api/transactions` with valid body returns 201 and the created transaction.
- `PATCH /api/transactions/TXN-20260824-001/status` with `{ "status": "completed" }`
  returns the updated record.
- `GET /api/transactions?status=requested` returns only requested transactions.

---

## Task 8 — Frontend .env & API service module

- [ ] Add `VITE_API_URL=http://localhost:3001` to `HOSPITAL1/.env` (create if not exists)
- [ ] Create `src/services/api.ts` with typed fetch wrappers:
  - `fetchHospitals()` → `Hospital[]`
  - `fetchResources(filters?)` → `Resource[]`
  - `fetchTransactions(status?)` → `Transaction[]`
  - `createTransaction(payload)` → `Transaction`
  - `updateTransactionStatus(id, status)` → `Transaction`
- [ ] All functions should throw on non-2xx responses with the error message from
      `{ error }` in the response body

**Acceptance:** TypeScript compiles with no errors (`npm run build` in HOSPITAL1/).

---

## Task 9 — Wire the frontend to the API

- [ ] Update `App.tsx`:
  - Replace static `resources` state init with `useEffect` + `fetchResources()`
  - Replace static `hospitals` with `useEffect` + `fetchHospitals()`
  - Replace static `transactions` with `useEffect` + `fetchTransactions()`
  - Update `handleSubmit` to `await createTransaction(txn)` then prepend result to state
  - Update `handleUpdateStatus` to `await updateTransactionStatus(id, status)` then
    update local state optimistically
- [ ] Add a simple loading state (`isLoading: boolean`) so the UI doesn't flash empty on startup
- [ ] Remove all imports from `src/data/mockData.ts` in `App.tsx`

**Acceptance:** Running both servers (`npm run dev` in each directory) shows the app
populated with real database data. Creating a transaction via the modal persists to SQLite.

---

## Task 10 — Documentation & .gitignore updates

- [ ] Create `backend/.env.example` committed to repo
- [ ] Add `backend/.env`, `backend/prisma/dev.db`, `backend/node_modules` to root `.gitignore`
- [ ] Add a `## Running Locally` section to `README.md` with the two-command startup:
  ```
  # Terminal 1 — backend
  cd backend && npm install && npm run db:migrate && npm run db:seed && npm run dev

  # Terminal 2 — frontend
  npm run dev
  ```

**Acceptance:** A fresh clone can follow the README and have both servers running
with seeded data in under 5 minutes.
