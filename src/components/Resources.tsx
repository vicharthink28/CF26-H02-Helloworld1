import { useState } from 'react';
import type { Resource, Hospital } from '../types';
import { ResourceCard } from './ResourceCard';

interface ResourcesProps {
  resources: Resource[];
  hospitals: Hospital[];
  onRequest: (resource: Resource, hospitalName: string) => void;
}

export function Resources({ resources, hospitals, onRequest }: ResourcesProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hospitalFilter, setHospitalFilter] = useState<string>('all');

  const filtered = resources.filter((r) => {
    const hospital = hospitals.find(h => h.id === r.hospitalId);
    const matchesSearch = !search || r.type.toLowerCase().includes(search.toLowerCase()) || hospital?.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesHospital = hospitalFilter === 'all' || r.hospitalId === hospitalFilter;
    return matchesSearch && matchesType && matchesStatus && matchesHospital;
  });

  const types = ['all', 'ICU Beds', 'Blood', 'Ventilators', 'Oxygen', 'Ambulances'];
  const statuses = ['all', 'available', 'low', 'critical'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resource Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm">Browse and request clinical resources across the network.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search resources or hospitals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            {types.map((t) => (
              <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          <select
            value={hospitalFilter}
            onChange={(e) => setHospitalFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="all">All Hospitals</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span>{filtered.length} resources found</span>
          {(search || typeFilter !== 'all' || statusFilter !== 'all' || hospitalFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setHospitalFilter('all'); }}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((resource) => {
            const hospital = hospitals.find(h => h.id === resource.hospitalId);
            return (
              <ResourceCard
                key={resource.id}
                resource={resource}
                hospitalName={hospital?.name || 'Unknown'}
                onRequest={onRequest}
              />
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-gray-500 text-sm">No resources match your search criteria.</p>
          <button
            onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setHospitalFilter('all'); }}
            className="mt-3 text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
