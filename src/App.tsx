import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Resources } from './components/Resources';
import { Transactions } from './components/Transactions';
import { RequestModal } from './components/RequestModal';
import { LoginModal } from './components/LoginModal';
import { useAuth } from './context/AuthContext';
import { useEventStream } from './services/eventStream';
import {
  fetchHospitals,
  fetchResources,
  fetchTransactions,
  createTransaction,
  updateTransactionStatus,
  type CreateTransactionPayload,
} from './services/api';
import type { Hospital, Resource, Transaction, Page, ConflictEvent } from './types';

// ─── Real-time status indicator ───────────────────────────────────────────────

function LiveBadge({ connected }: { connected: boolean }) {
  return (
    <div
      title={connected ? 'Real-time connected' : 'Real-time disconnected'}
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${connected
          ? 'bg-teal-500/10 text-teal-600'
          : 'bg-gray-200 text-gray-400'
        }`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-teal-500 animate-pulse' : 'bg-gray-400'}`} />
      {connected ? 'Live' : 'Offline'}
    </div>
  );
}

// ─── Conflict toast ───────────────────────────────────────────────────────────

interface ConflictToast {
  id: string;
  message: string;
}

function ConflictBanner({ toasts, onDismiss }: { toasts: ConflictToast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[300] space-y-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-3 bg-white border border-red-200 rounded-xl shadow-lg p-4"
        >
          <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-red-700 mb-0.5">Resource Conflict</p>
            <p className="text-xs text-gray-600">{t.message}</p>
          </div>
          <button onClick={() => onDismiss(t.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500 font-medium">Connecting to PulseCare API…</p>
      </div>
    </div>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm max-w-md w-full p-8 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to reach the API</h2>
        <p className="text-sm text-gray-500 mb-1">{message}</p>
        <p className="text-xs text-gray-400 mb-6">
          Make sure the backend is running:{' '}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
            cd backend &amp;&amp; npm run dev
          </code>
        </p>
        <button
          onClick={onRetry}
          className="w-full py-2.5 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// ─── Authenticated shell ──────────────────────────────────────────────────────

function AuthenticatedApp() {
  const { user, logout } = useAuth();

  const [page, setPage] = useState<Page>('dashboard');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | undefined>();
  const [selectedHospitalName, setSelectedHospitalName] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [conflictToasts, setConflictToasts] = useState<ConflictToast[]>([]);

  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function mergeResource(updated: Resource) {
    setResources(prev => {
      const idx = prev.findIndex(r => r.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      // Only apply if version is newer (guards against out-of-order SSE delivery)
      if (prev[idx].version > updated.version) return prev;
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }

  function mergeTransaction(updated: Transaction) {
    setTransactions(prev => {
      const idx = prev.findIndex(t => t.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }

  function addConflictToast(message: string) {
    const id = `conflict-${Date.now()}`;
    setConflictToasts(prev => [...prev, { id, message }]);
    // Auto-dismiss after 6 s
    const timer = setTimeout(() => {
      setConflictToasts(prev => prev.filter(t => t.id !== id));
      toastTimers.current.delete(id);
    }, 6000);
    toastTimers.current.set(id, timer);
  }

  function dismissToast(id: string) {
    const timer = toastTimers.current.get(id);
    if (timer) { clearTimeout(timer); toastTimers.current.delete(id); }
    setConflictToasts(prev => prev.filter(t => t.id !== id));
  }

  // Clean up timers on unmount
  useEffect(() => {
    return () => { toastTimers.current.forEach(clearTimeout); };
  }, []);

  // ── SSE subscription ─────────────────────────────────────────────────────────

  useEventStream({
    onConnected: () => setLiveConnected(true),
    onDisconnected: () => setLiveConnected(false),

    onResourceUpdated: (resource) => mergeResource(resource),

    onTransactionCreated: (txn) => {
      setTransactions(prev => {
        // Avoid duplicate if we already added it optimistically via POST response
        if (prev.some(t => t.id === txn.id)) return prev;
        return [txn, ...prev];
      });
    },

    onTransactionStatusChanged: (txn) => mergeTransaction(txn),

    onConflict: (payload: ConflictEvent['payload']) => {
      addConflictToast(
        `Insufficient supply for ${payload.resourceType}: ` +
        `requested ${payload.requested}, only ${payload.available} available.`,
      );
    },
  });

  // ── Initial data load ─────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, r, t] = await Promise.all([
        fetchHospitals(),
        fetchResources(),
        fetchTransactions(),
      ]);
      setHospitals(h);
      setResources(r);
      setTransactions(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Open request modal ────────────────────────────────────────────────────────

  const handleRequest = useCallback((resource?: Resource, hospitalName?: string) => {
    setSelectedResource(resource);
    setSelectedHospitalName(hospitalName ?? '');
    setModalOpen(true);
  }, []);

  // ── Submit transaction ────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (
    txn: Omit<Transaction, 'id' | 'createdAt' | 'status' | 'previousStatus' | 'performedBy'>,
  ) => {
    try {
      const payload: CreateTransactionPayload = {
        resourceId: txn.resourceId,
        resourceType: txn.resourceType,
        hospitalId: txn.hospitalId,
        hospitalName: txn.hospitalName,
        quantity: txn.quantity,
        urgency: txn.urgency,
        unit: txn.unit,
        note: txn.note,
      };
      const created = await createTransaction(payload);
      setTransactions(prev => [created, ...prev]);
      setModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit request';
      if (msg.includes('Conflict') || msg.includes('insufficient')) {
        addConflictToast(msg);
      } else {
        alert(msg);
      }
    }
  }, []);

  // ── Update transaction status ─────────────────────────────────────────────────

  const handleUpdateStatus = useCallback(async (
    id: string,
    status: Transaction['status'],
  ) => {
    // Optimistic update
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    try {
      const updated = await updateTransactionStatus(id, status);
      setTransactions(prev => prev.map(t => t.id === id ? updated : t));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      if (msg.includes('Conflict') || msg.includes('Invalid transition')) {
        addConflictToast(msg);
        loadAll(); // revert optimistic update
      } else {
        console.error('Failed to update status:', err);
        loadAll();
      }
    }
  }, [loadAll]);

  const activeCount = transactions.filter(
    t => ['requested', 'approved', 'in_transit'].includes(t.status),
  ).length;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorBanner message={error} onRetry={loadAll} />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Conflict toasts */}
      <ConflictBanner toasts={conflictToasts} onDismiss={dismissToast} />

      {/* Mobile toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 bg-navy-900 text-white rounded-lg shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Live badge — visible on desktop top-right */}
      <div className="hidden lg:flex fixed top-4 right-4 z-50">
        <LiveBadge connected={liveConnected} />
      </div>

      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/20"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar
          currentPage={page}
          onNavigate={(p) => { setPage(p); setMobileMenuOpen(false); }}
          activeTransactionCount={activeCount}
          user={user!}
          onLogout={logout}
        />
      </div>

      {/* Main content */}
      <main className="min-h-screen lg:ml-64">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {page === 'dashboard' && (
            <Dashboard
              resources={resources}
              transactions={transactions}
              hospitals={hospitals}
              onRequest={handleRequest}
              onNavigate={setPage}
            />
          )}
          {page === 'resources' && (
            <Resources
              resources={resources}
              hospitals={hospitals}
              onRequest={handleRequest}
            />
          )}
          {page === 'transactions' && (
            <Transactions
              transactions={transactions}
              onUpdateStatus={handleUpdateStatus}
            />
          )}
        </div>
      </main>

      <RequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        preselectedResource={selectedResource}
        preselectedHospitalName={selectedHospitalName}
        hospitals={hospitals}
      />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function App() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AuthenticatedApp /> : <LoginModal />;
}

export default App;
