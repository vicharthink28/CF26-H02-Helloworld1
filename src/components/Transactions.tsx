import { useState } from 'react';
import type { Transaction } from '../types';

const statusFlow = ['requested', 'approved', 'in_transit', 'completed'];

const statusConfig = {
  requested: { color: 'text-gray-600', bg: 'bg-gray-100', label: 'Requested' },
  approved: { color: 'text-primary-700', bg: 'bg-primary-100', label: 'Approved' },
  in_transit: { color: 'text-warning', bg: 'bg-warning-light', label: 'In Transit' },
  completed: { color: 'text-success', bg: 'bg-success-light', label: 'Completed' },
  cancelled: { color: 'text-danger', bg: 'bg-danger-light', label: 'Cancelled' },
};

interface TransactionsProps {
  transactions: Transaction[];
  onUpdateStatus: (id: string, status: Transaction['status']) => void;
}

export function Transactions({ transactions, onUpdateStatus }: TransactionsProps) {
  const [filter, setFilter] = useState<string>('all');

  const filtered = transactions.filter(t => filter === 'all' || t.status === filter);

  const getNextStatus = (current: Transaction['status']): Transaction['status'] | null => {
    const idx = statusFlow.indexOf(current);
    if (idx >= 0 && idx < statusFlow.length - 1) return statusFlow[idx + 1] as Transaction['status'];
    return null;
  };

  const getPrevStatus = (current: Transaction['status']): Transaction['status'] | null => {
    const idx = statusFlow.indexOf(current);
    if (idx > 0) return statusFlow[idx - 1] as Transaction['status'];
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transaction Tracking</h1>
        <p className="text-gray-500 mt-1 text-sm">Monitor and manage all resource requests across the network.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex gap-2">
          {['all', 'requested', 'approved', 'in_transit', 'completed', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === s
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s === 'all' ? 'All' : statusConfig[s as keyof typeof statusConfig].label}
              {s !== 'all' && (
                <span className="ml-1.5 text-xs opacity-75">
                  ({transactions.filter(t => t.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map((txn) => {
            const config = statusConfig[txn.status];
            const currentIdx = statusFlow.indexOf(txn.status);
            const nextStatus = getNextStatus(txn.status);
            const prevStatus = getPrevStatus(txn.status);

            return (
              <div key={txn.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{txn.id}</h3>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                        <span className="font-medium text-gray-900">{txn.resourceType}</span>
                        <span className="text-gray-400">&middot;</span>
                        <span>Qty: {txn.quantity} {txn.unit}</span>
                        <span className="text-gray-400">&middot;</span>
                        <span>{txn.hospitalName}</span>
                        <span className="text-gray-400">&middot;</span>
                        <span className="capitalize">{txn.urgency}</span>
                      </div>
                      {txn.note && (
                        <p className="mt-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2 inline-block">
                          {txn.note}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-gray-400">
                        Created {new Date(txn.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </p>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-1">
                        {statusFlow.map((s, i) => (
                          <div key={s} className="flex items-center gap-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                              currentIdx >= i ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-400'
                            }`}>
                              {i + 1}
                            </div>
                            {i < statusFlow.length - 1 && (
                              <div className={`w-4 h-0.5 ${currentIdx > i ? 'bg-teal-500' : 'bg-gray-200'}`} />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1.5 mt-1">
                        {prevStatus && (
                          <button
                            onClick={() => onUpdateStatus(txn.id, prevStatus)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            Back
                          </button>
                        )}
                        {nextStatus && (
                          <button
                            onClick={() => onUpdateStatus(txn.id, nextStatus)}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors shadow-sm"
                          >
                            {nextStatus === 'approved' && 'Approve'}
                            {nextStatus === 'in_transit' && 'Dispatch'}
                            {nextStatus === 'completed' && 'Complete'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 text-sm">No transactions match this filter.</p>
        </div>
      )}
    </div>
  );
}
