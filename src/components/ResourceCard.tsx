import type { Resource } from '../types';

const icons: Record<string, React.ReactNode> = {
  'ICU Beds': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  Blood: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  Ventilators: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  ),
  Oxygen: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  Ambulances: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
};

const statusConfig = {
  available: { color: 'bg-success-light text-success', label: 'Available' },
  low: { color: 'bg-warning-light text-warning', label: 'Low Stock' },
  critical: { color: 'bg-danger-light text-danger', label: 'Critical' },
};

interface ResourceCardProps {
  resource: Resource;
  hospitalName: string;
  onRequest: (resource: Resource, hospitalName: string) => void;
}

export function ResourceCard({ resource, hospitalName, onRequest }: ResourceCardProps) {
  const config = statusConfig[resource.status];
  const icon = icons[resource.type];

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${resource.status === 'available' ? 'bg-primary-50 text-primary-600' : resource.status === 'low' ? 'bg-warning-light text-warning' : 'bg-danger-light text-danger'}`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{resource.type}</h3>
            <p className="text-xs text-gray-500">{hospitalName}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900">{resource.quantity}</p>
          <p className="text-xs text-gray-500">{resource.unit} available</p>
        </div>
        <button
          onClick={() => onRequest(resource, hospitalName)}
          className="px-4 py-2 bg-navy-900 text-white text-sm font-medium rounded-lg hover:bg-navy-800 active:scale-95 transition-all duration-150 shadow-sm"
        >
          Request
        </button>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-50">
        <p className="text-xs text-gray-400">
          Updated {new Date(resource.lastUpdated).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
        </p>
      </div>
    </div>
  );
}
