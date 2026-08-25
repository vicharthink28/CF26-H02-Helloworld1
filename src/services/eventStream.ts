/**
 * useEventStream — React hook for the PulseCare SSE stream
 *
 * Opens a persistent EventSource connection to /api/events and dispatches
 * typed callbacks for each event type. Automatically reconnects on error.
 *
 * Usage:
 *   useEventStream({
 *     onResourceUpdated:        (resource) => setResources(...),
 *     onTransactionCreated:     (txn)      => setTransactions(...),
 *     onTransactionStatusChanged:(txn)     => setTransactions(...),
 *     onConflict:               (payload)  => toast.error(...),
 *   });
 */

import { useEffect, useRef } from 'react';
import type {
  Resource,
  Transaction,
  PulseCareEvent,
  PulseCareEventType,
  ConflictEvent,
} from '../types';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const SSE_URL = `${BASE}/api/events`;

// ─── Re-connection back-off ───────────────────────────────────────────────────

const MIN_RETRY_MS = 2_000;
const MAX_RETRY_MS = 30_000;

export interface EventStreamCallbacks {
  onResourceUpdated?: (resource: Resource) => void;
  onTransactionCreated?: (txn: Transaction) => void;
  onTransactionStatusChanged?: (txn: Transaction) => void;
  onConflict?: (payload: ConflictEvent['payload']) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export function useEventStream(callbacks: EventStreamCallbacks): void {
  // Keep a stable ref so the effect doesn't re-run when callbacks change identity
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    let es: EventSource | null = null;
    let retryMs = MIN_RETRY_MS;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    function parseEvent<T>(raw: string): PulseCareEvent<T> | null {
      try { return JSON.parse(raw) as PulseCareEvent<T>; }
      catch { return null; }
    }

    function handleEvent(type: PulseCareEventType, raw: string) {
      const event = parseEvent<unknown>(raw);
      if (!event) return;

      const cb = callbacksRef.current;

      switch (type) {
        case 'resource.updated':
          cb.onResourceUpdated?.(event.payload as Resource);
          break;
        case 'transaction.created':
          cb.onTransactionCreated?.(event.payload as Transaction);
          break;
        case 'transaction.status_changed':
          cb.onTransactionStatusChanged?.(event.payload as Transaction);
          break;
        case 'transaction.conflict':
          cb.onConflict?.(event.payload as ConflictEvent['payload']);
          break;
        case 'connected':
          retryMs = MIN_RETRY_MS;   // reset back-off on successful connect
          cb.onConnected?.();
          break;
        default:
          break;
      }
    }

    function connect() {
      if (!mounted) return;

      es = new EventSource(SSE_URL, { withCredentials: true });

      const EVENT_TYPES: PulseCareEventType[] = [
        'resource.updated',
        'transaction.created',
        'transaction.status_changed',
        'transaction.conflict',
        'transaction.duplicate',
        'connected',
        'ping',
      ];

      EVENT_TYPES.forEach((type) => {
        es!.addEventListener(type, (e: MessageEvent) => {
          handleEvent(type, e.data as string);
        });
      });

      es.onerror = () => {
        es?.close();
        callbacksRef.current.onDisconnected?.();
        if (mounted) {
          retryTimer = setTimeout(() => {
            retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
            connect();
          }, retryMs);
        }
      };
    }

    connect();

    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, []); // runs once — callbacks are accessed via ref
}
