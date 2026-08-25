import type { Resource, Transaction, Hospital, Page } from '../types';

const statusFlow: Record<string, { color: string; bg: string; label: string }> = {
  requested: { color: 'text-gray-600', bg: 'bg-gray-100', label: 'Requested' },
  approved: { color: 'text-primary-700', bg: 'bg-primary-100', label: 'Approved' },
  in_transit: { color: 'text-warning', bg: 'bg-warning-light', label: 'In Transit' },
  completed: { color: 'text-success', bg: 'bg-success-light', label: 'Completed' },
  cancelled: { color: 'text-danger', bg: 'bg-danger-light', label: 'Cancelled' },
};

interface DashboardProps {
  resources: Resource[];
  transactions: Transaction[];
  hospitals: Hospital[];
  onRequest: (resource?: Resource, hospitalName?: string) => void;
  onNavigate: (page: Page) => void;
}

export function Dashboard({ resources, transactions, hospitals, onRequest, onNavigate }: DashboardProps) {
  const totalResources = resources.length;
  const availableResources = resources.filter(r => r.status === 'available').length;
  const activeTransactions = transactions.filter(t => ['requested', 'approved', 'in_transit'].includes(t.status)).length;
  const criticalAlerts = resources.filter(r => r.status === 'critical').length;

  const statusOrder = ['requested', 'approved', 'in_transit', 'completed'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, Dr. Rajesh</h1>
        <p className="text-gray-500 mt-1 text-sm">Here's what's happening across your clinical resource network today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Resources</p>
            <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalResources}</p>
          <p className="text-xs text-gray-500 mt-1">{availableResources} available</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Transactions</p>
            <div className="p-2 bg-teal-50 rounded-lg text-teal-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{activeTransactions}</p>
          <p className="text-xs text-gray-500 mt-1">In progress</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Hospitals</p>
            <div className="p-2 bg-navy-50 rounded-lg text-navy-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{hospitals.length}</p>
          <p className="text-xs text-gray-500 mt-1">Network partners</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Critical Alerts</p>
            <div className="p-2 bg-danger-light rounded-lg text-danger">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{criticalAlerts}</p>
          <p className="text-xs text-gray-500 mt-1">Need immediate attention</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Resource Availability</h2>
            <button onClick={() => onNavigate('resources')} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all
            </button>
          </div>
          <div className="p-5 space-y-4">
            {['ICU Beds', 'Blood', 'Ventilators', 'Oxygen', 'Ambulances'].map((type) => {
              const typeResources = resources.filter(r => r.type === type);
              const total = typeResources.reduce((sum, r) => sum + r.quantity, 0);
              const critical = typeResources.filter(r => r.status === 'critical').length;
              const low = typeResources.filter(r => r.status === 'low').length;

              return (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-600">
                      {type === 'ICU Beds' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
                      {type === 'Blood' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
                      {type === 'Ventilators' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>}
                      {type === 'Oxygen' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
                      {type === 'Ambulances' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{total}</span>
                    {critical > 0 && (
                      <span className="px-2 py-0.5 bg-danger-light text-danger text-xs font-medium rounded-full">
                        {critical} critical
                      </span>
                    )}
                    {low > 0 && !critical && (
                      <span className="px-2 py-0.5 bg-warning-light text-warning text-xs font-medium rounded-full">
                        {low} low
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Active Transactions</h2>
            <button onClick={() => onNavigate('transactions')} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all
            </button>
          </div>
          <div className="p-5 space-y-3">
            {transactions.filter(t => ['requested', 'approved', 'in_transit'].includes(t.status)).slice(0, 4).map((txn) => (
              <div key={txn.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{txn.resourceType}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusFlow[txn.status].bg} ${statusFlow[txn.status].color}`}>
                      {statusFlow[txn.status].label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{txn.hospitalName} &middot; Qty: {txn.quantity}</p>
                </div>
                <div className="flex items-center gap-1.5 ml-3">
                  {statusOrder.map((s, i) => (
                    <div key={s} className={`w-2 h-2 rounded-full ${txn.status === s ? 'bg-teal-500 scale-125' : statusOrder.indexOf(txn.status) > i ? 'bg-teal-300' : 'bg-gray-200'}`} />
                  ))}
                </div>
              </div>
            ))}
            {transactions.filter(t => ['requested', 'approved', 'in_transit'].includes(t.status)).length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm">No active transactions</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900">Critical Resource Alert</h2>
        </div>
        <div className="p-5">
          {criticalAlerts > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {resources.filter(r => r.status === 'critical').map((resource) => {
                const hospital = hospitals.find(h => h.id === resource.hospitalId);
                return (
                  <div key={resource.id} className="p-4 bg-danger-light border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-danger rounded-full animate-pulse" />
                      <span className="text-sm font-semibold text-danger">{resource.type}</span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{hospital?.name}</p>
                    <p className="text-xs text-gray-500">{resource.quantity} {resource.unit} remaining</p>
                    <button
                      onClick={() => onRequest(resource, hospital?.name || '')}
                      className="mt-3 w-full px-3 py-1.5 bg-danger text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Request Now
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">No critical alerts at this time</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
