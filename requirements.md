# PulseCare Backend — Requirements

## Overview

PulseCare is a Clinical Resource Network dashboard that allows hospital coordinators to monitor
and manage medical resources (ICU Beds, Blood, Ventilators, Oxygen, Ambulances) across a network
of partner hospitals, and track resource requests via a transaction workflow.

The frontend (React + Vite + Tailwind) currently runs entirely off in-memory mock data. This spec
defines a lightweight Node.js / Express backend with a SQLite database (via Prisma) that replaces
that mock data with real persistence.

---

## Functional Requirements

### REQ-1 — Hospitals
- REQ-1.1: The system shall store hospital records with id, name, location, contact, and type.
- REQ-1.2: The system shall expose an endpoint to list all hospitals.
- REQ-1.3: The system shall expose an endpoint to fetch a single hospital by id.

### REQ-2 — Resources
- REQ-2.1: The system shall store resource records linked to a hospital, including type, quantity,
  status (available | low | critical), unit, and lastUpdated timestamp.
- REQ-2.2: Resource type must be one of: ICU Beds, Blood, Ventilators, Oxygen, Ambulances.
- REQ-2.3: The system shall expose an endpoint to list all resources (with optional filters for
  type, status, and hospitalId).
- REQ-2.4: The system shall expose an endpoint to fetch a single resource by id.
- REQ-2.5: The system shall expose an endpoint to update a resource's quantity and/or status
  (used when inventory changes).

### REQ-3 — Transactions
- REQ-3.1: The system shall store transaction records with id, resourceId, resourceType,
  hospitalId, hospitalName, quantity, urgency, note, status, createdAt, and unit.
- REQ-3.2: Transaction status must follow the flow:
  requested → approved → in_transit → completed (or cancelled at any point).
- REQ-3.3: urgency must be one of: routine | urgent | emergency.
- REQ-3.4: The system shall expose an endpoint to list all transactions (with optional filter
  by status).
- REQ-3.5: The system shall expose an endpoint to create a new transaction (submitted from
  the RequestModal component).
- REQ-3.6: The system shall expose an endpoint to update only the status field of a transaction
  (used by the Transactions component's Approve / Dispatch / Complete / Back buttons).

### REQ-4 — Seed Data
- REQ-4.1: A seed script shall populate the database with the 5 hospitals, 25 resources, and
  6 transactions currently in mockData.ts so the app works out-of-the-box.

### REQ-5 — CORS & Environment
- REQ-5.1: The API shall allow cross-origin requests from the Vite dev server (localhost:5173).
- REQ-5.2: Server port and database URL shall be configurable via a .env file.
- REQ-5.3: The API shall return JSON with consistent response shapes: `{ data, error }`.

### REQ-6 — Health Check
- REQ-6.1: A GET /health endpoint shall return `{ status: "ok" }` so the frontend can check
  connectivity before making real API calls.
