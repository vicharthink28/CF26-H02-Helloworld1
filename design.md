# PulseCare Backend — Design

## Architecture Overview

```
┌─────────────────────────────────┐
│   React Frontend  (port 5173)   │
│  Vite + React 19 + TailwindCSS  │
└────────────────┬────────────────┘
                 │ HTTP / JSON
                 ▼
┌─────────────────────────────────┐
│   Express API Server (port 3001)│
│   Node.js + TypeScript          │
│   ├── /api/hospitals            │
│   ├── /api/resources            │
│   ├── /api/transactions         │
│   └── /health                   │
└────────────────┬────────────────┘
                 │ Prisma ORM
                 ▼
┌─────────────────────────────────┐
│   SQLite Database               │
│   prisma/dev.db                 │
└─────────────────────────────────┘
```

**Tech choices:**
- **Runtime**: Node.js (matches the existing npm/Vite project ecosystem)
- **Framework**: Express 4 — minimal, well-known, zero config overhead
- **ORM**: Prisma 5 — schema-first, typed client, great SQLite support, easy migrations
- **Database**: SQLite — zero-install, single file, perfect for local dev
- **Language**: TypeScript (consistent with the frontend codebase)

---

## Directory Structure

```
HOSPITAL1/
├── src/                        # existing frontend source
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # database schema
│   │   └── seed.ts             # seed script
│   ├── src/
│   │   ├── index.ts            # express app entry point
│   │   ├── db.ts               # prisma client singleton
│   │   ├── routes/
│   │   │   ├── hospitals.ts
│   │   │   ├── resources.ts
│   │   │   └── transactions.ts
│   │   └── middleware/
│   │       └── errorHandler.ts
│   ├── .env                    # environment variables (gitignored)
│   ├── .env.example            # template committed to repo
│   ├── package.json
│   └── tsconfig.json
└── ...
```

---

## Database Schema (Prisma)

```prisma
// backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Hospital {
  id          String        @id
  name        String
  location    String
  contact     String
  type        String
  resources   Resource[]
  transactions Transaction[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

model Resource {
  id           String        @id
  type         String        // 'ICU Beds' | 'Blood' | 'Ventilators' | 'Oxygen' | 'Ambulances'
  hospitalId   String
  hospital     Hospital      @relation(fields: [hospitalId], references: [id])
  quantity     Int
  status       String        // 'available' | 'low' | 'critical'
  unit         String
  lastUpdated  DateTime      @default(now()) @updatedAt
  transactions Transaction[]
  createdAt    DateTime      @default(now())
}

model Transaction {
  id           String   @id
  resourceId   String
  resource     Resource @relation(fields: [resourceId], references: [id])
  resourceType String
  hospitalId   String
  hospital     Hospital @relation(fields: [hospitalId], references: [id])
  hospitalName String
  quantity     Int
  urgency      String   // 'routine' | 'urgent' | 'emergency'
  note         String   @default("")
  status       String   // 'requested' | 'approved' | 'in_transit' | 'completed' | 'cancelled'
  unit         String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

---

## REST API Endpoints

### Base URL: `http://localhost:3001/api`

---

### Health

| Method | Path      | Description                    |
|--------|-----------|--------------------------------|
| GET    | /health   | Returns `{ status: "ok" }`     |

---

### Hospitals

| Method | Path                | Description                        |
|--------|---------------------|------------------------------------|
| GET    | /api/hospitals      | List all hospitals                 |
| GET    | /api/hospitals/:id  | Get a single hospital by id        |

**GET /api/hospitals response:**
```json
{
  "data": [
    {
      "id": "h1",
      "name": "AIIMS Delhi",
      "location": "New Delhi, Delhi",
      "contact": "+91-11-2658-8500",
      "type": "Central Government"
    }
  ]
}
```

---

### Resources

| Method | Path                  | Description                               |
|--------|-----------------------|-------------------------------------------|
| GET    | /api/resources        | List all resources (supports query params)|
| GET    | /api/resources/:id    | Get a single resource by id               |
| PATCH  | /api/resources/:id    | Update quantity and/or status             |

**Query params for GET /api/resources:**
- `type` — filter by resource type (e.g. `?type=Blood`)
- `status` — filter by status (e.g. `?status=critical`)
- `hospitalId` — filter by hospital (e.g. `?hospitalId=h2`)

**PATCH /api/resources/:id body:**
```json
{ "quantity": 10, "status": "low" }
```

---

### Transactions

| Method | Path                        | Description                          |
|--------|-----------------------------|--------------------------------------|
| GET    | /api/transactions           | List all transactions                |
| POST   | /api/transactions           | Create a new transaction             |
| PATCH  | /api/transactions/:id/status| Update transaction status only       |

**Query params for GET /api/transactions:**
- `status` — filter by status (e.g. `?status=requested`)

**POST /api/transactions body:**
```json
{
  "resourceId": "r2",
  "resourceType": "ICU Beds",
  "hospitalId": "h2",
  "hospitalName": "Apollo Hospitals",
  "quantity": 2,
  "urgency": "urgent",
  "note": "Patient from road accident needs ICU",
  "unit": "beds"
}
```
The server assigns `id` (auto-generated), `status: "requested"`, and `createdAt`.

**PATCH /api/transactions/:id/status body:**
```json
{ "status": "approved" }
```
Valid transitions: `requested → approved → in_transit → completed` or `* → cancelled`.

---

## Response Shape Convention

All responses follow this envelope:
```json
// Success
{ "data": <payload> }

// Error
{ "error": "<message>", "details": "<optional>" }
```

---

## Environment Configuration

**backend/.env.example**
```
# Express server port
PORT=3001

# Prisma SQLite database path
DATABASE_URL="file:./prisma/dev.db"

# Frontend origin for CORS
FRONTEND_URL=http://localhost:5173
```

---

## CORS Strategy

Express is configured with the `cors` package, allowing only the origin defined in
`FRONTEND_URL`. This keeps the API from being consumed by arbitrary origins during
local development.

---

## Frontend Integration Plan

Once the backend is running, replace mock data imports in `App.tsx` with `fetch` calls:

| Current mock                    | Replacement API call                         |
|---------------------------------|----------------------------------------------|
| `import { hospitals } ...`      | `GET /api/hospitals`                         |
| `import { resources } ...`      | `GET /api/resources`                         |
| `import { initialTransactions }`| `GET /api/transactions`                      |
| `handleSubmit` in App.tsx       | `POST /api/transactions`                     |
| `handleUpdateStatus` in App.tsx | `PATCH /api/transactions/:id/status`         |

A lightweight `api.ts` service module in `src/services/` should wrap all fetch calls
with error handling and the base URL from a `VITE_API_URL` env variable.
