/**
 * PulseCare API Service — Phase 2
 *
 * Changes:
 *  - request() now accepts extraHeaders so callers can pass
 *    Idempotency-Key and X-User-ID per request.
 *  - createTransaction accepts an optional idempotencyKey.
 *  - updateResource accepts a version for optimistic concurrency.
 *  - fetchAuditLogs added.
 */

import type {
  Hospital,
  Resource,
  ResourceStatus,
  Transaction,
  TransactionStatus,
  Urgency,
  ResourceType,
  AuditLog,
} from '../types';

// ─── Base URL ─────────────────────────────────────────────────────────────────
// Use relative paths so all /api requests go through the Vite dev-proxy
// (or the same origin in production). The VITE_API_BASE_URL env var is kept
// as an escape hatch for non-proxied environments (e.g. Docker, staging).

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// ─── Auth header helper ───────────────────────────────────────────────────────

function getUserId(): string {
  try {
    const raw = localStorage.getItem('pulsecare_auth');
    if (!raw) return 'anonymous';
    return (JSON.parse(raw) as { id?: string }).id ?? 'anonymous';
  } catch {
    return 'anonymous';
  }
}

// ─── Shared request helper ────────────────────────────────────────────────────

async function request<T>(
  path: string,
  init?: RequestInit,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': getUserId(),
      ...extraHeaders,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error((json as { error?: string }).error ?? `Request failed: ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }

  return (json as { data: T }).data;
}

// ─── Hospitals ────────────────────────────────────────────────────────────────

export function fetchHospitals(): Promise<Hospital[]> {
  return request<Hospital[]>('/api/hospitals');
}

export function fetchHospital(id: string): Promise<Hospital> {
  return request<Hospital>(`/api/hospitals/${id}`);
}

// ─── Resources ────────────────────────────────────────────────────────────────

export interface ResourceFilters {
  type?: ResourceType;
  status?: ResourceStatus;
  hospitalId?: string;
}

export function fetchResources(filters?: ResourceFilters): Promise<Resource[]> {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.hospitalId) params.set('hospitalId', filters.hospitalId);
  const qs = params.toString();
  return request<Resource[]>(`/api/resources${qs ? `?${qs}` : ''}`);
}

export function fetchResource(id: string): Promise<Resource> {
  return request<Resource>(`/api/resources/${id}`);
}

/**
 * Update a resource.
 * Pass `version` (from the resource you read) to enable optimistic concurrency.
 * A 409 will be thrown if the server has a newer version.
 */
export function updateResource(
  id: string,
  data: { quantity?: number; status?: ResourceStatus; version?: number; reason?: string },
): Promise<Resource> {
  return request<Resource>(`/api/resources/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function fetchTransactions(status?: TransactionStatus): Promise<Transaction[]> {
  const qs = status ? `?status=${status}` : '';
  return request<Transaction[]>(`/api/transactions${qs}`);
}

export interface CreateTransactionPayload {
  resourceId: string;
  resourceType: ResourceType;
  hospitalId: string;
  hospitalName: string;
  quantity: number;
  urgency: Urgency;
  unit: string;
  note?: string;
  idempotencyKey?: string;   // supply a UUID for exactly-once semantics
}

export function createTransaction(payload: CreateTransactionPayload): Promise<Transaction> {
  const { idempotencyKey, ...body } = payload;
  return request<Transaction>(
    '/api/transactions',
    { method: 'POST', body: JSON.stringify(body) },
    idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  );
}

export function updateTransactionStatus(
  id: string,
  status: TransactionStatus,
  reason?: string,
): Promise<Transaction> {
  return request<Transaction>(`/api/transactions/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditFilters {
  resourceId?: string;
  transactionId?: string;
  hospitalId?: string;
  performedBy?: string;
  actionType?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function fetchAuditLogs(
  filters?: AuditFilters,
): Promise<{ data: AuditLog[]; meta: { total: number; limit: number; offset: number } }> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined) params.set(k, String(v));
    });
  }
  const qs = params.toString();

  const res = await fetch(`${BASE}/api/audit${qs ? `?${qs}` : ''}`, {
    headers: { 'X-User-ID': getUserId() },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed: ${res.status}`);
  return json as { data: AuditLog[]; meta: { total: number; limit: number; offset: number } };
}
