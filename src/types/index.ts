// ─── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole = 'Doctor' | 'Nurse' | 'Hospital Admin';

export interface AuthUser {
  id: string;   // staff ID / mobile number
  name: string;
  role: UserRole;
  loginAt: string;   // ISO timestamp
}

// ─── Domain ───────────────────────────────────────────────────────────────────

export type ResourceType = 'ICU Beds' | 'Blood' | 'Ventilators' | 'Oxygen' | 'Ambulances';
export type ResourceStatus = 'available' | 'low' | 'critical';
export type TransactionStatus = 'requested' | 'approved' | 'in_transit' | 'completed' | 'cancelled';
export type Urgency = 'routine' | 'urgent' | 'emergency';
export type Page = 'dashboard' | 'resources' | 'transactions';

export interface Hospital {
  id: string;
  name: string;
  location: string;
  contact: string;
  type: string;
}

export interface Resource {
  id: string;
  type: ResourceType;
  hospitalId: string;
  quantity: number;
  capacity: number;      // Phase 2: ceiling; 0 = uncapped
  status: ResourceStatus;
  lastUpdated: string;
  unit: string;
  version: number;      // Phase 2: optimistic concurrency version
}

export interface Transaction {
  id: string;
  resourceId: string;
  resourceType: ResourceType;
  hospitalId: string;
  hospitalName: string;
  quantity: number;
  urgency: Urgency;
  note: string;
  status: TransactionStatus;
  previousStatus: string;   // Phase 2: last status snapshot
  performedBy: string;   // Phase 2: user who last acted
  createdAt: string;
  unit: string;
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export type AuditActionType =
  | 'RESOURCE_UPDATED'
  | 'TXN_CREATED'
  | 'TXN_STATUS_CHANGED'
  | 'TXN_CONFLICT'
  | 'TXN_DUPLICATE';

export interface AuditLog {
  id: string;
  actionType: AuditActionType;
  performedBy: string;
  resourceId: string | null;
  transactionId: string | null;
  hospitalId: string | null;
  previousState: string;   // JSON string
  newState: string;   // JSON string
  reason: string;
  metadata: string;   // JSON string
  createdAt: string;
}

// ─── Real-Time Events (SSE) ───────────────────────────────────────────────────

export type PulseCareEventType =
  | 'resource.updated'
  | 'transaction.created'
  | 'transaction.status_changed'
  | 'transaction.conflict'
  | 'transaction.duplicate'
  | 'ping'
  | 'connected';

export interface PulseCareEvent<T = unknown> {
  type: PulseCareEventType;
  payload: T;
  timestamp: string;
  actor?: string;
}

/** Discriminated union helpers for exhaustive event handling */
export type ResourceUpdatedEvent = PulseCareEvent<Resource>;
export type TransactionCreatedEvent = PulseCareEvent<Transaction>;
export type TransactionStatusEvent = PulseCareEvent<Transaction>;
export type ConflictEvent = PulseCareEvent<{
  resourceId: string;
  resourceType: ResourceType;
  requested: number;
  available: number;
}>;
