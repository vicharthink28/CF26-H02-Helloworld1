import { useState, useEffect } from 'react';
import type { Resource, Transaction, Hospital } from '../types';

const urgencyLevels = [
  { value: 'routine', label: 'Routine', color: 'text-gray-600', bg: 'bg-gray-100' },
  { value: 'urgent', label: 'Urgent', color: 'text-warning', bg: 'bg-warning-light' },
  { value: 'emergency', label: 'Emergency', color: 'text-danger', bg: 'bg-danger-light' },
];

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (txn: Omit<Transaction, 'id' | 'createdAt' | 'status' | 'previousStatus' | 'performedBy'>) => void;
  preselectedResource?: Resource;
  preselectedHospitalName?: string;
  hospitals: Hospital[];
}

export function RequestModal({ isOpen, onClose, onSubmit, preselectedResource, preselectedHospitalName, hospitals }: RequestModalProps) {
  const [resourceType, setResourceType] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [urgency, setUrgency] = useState<Transaction['urgency']>('routine');
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);
  const [txnId, setTxnId] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (preselectedResource) {
        setResourceType(preselectedResource.type);
        setHospitalId(preselectedResource.hospitalId);
        setQuantity(preselectedResource.quantity > 1 ? Math.min(preselectedResource.quantity, 3) : 1);
      } else {
        setResourceType('');
        setHospitalId('');
        setQuantity(1);
      }
      setUrgency('routine');
      setNote('');
      setSuccess(false);
      setTxnId('');
    }
  }, [isOpen, preselectedResource]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hospital = hospitals.find(h => h.id === hospitalId);
    const id = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const newTxn = {
      resourceId: preselectedResource?.id || `r-${Date.now()}`,
      resourceType: resourceType as Transaction['resourceType'],
      hospitalId,
      hospitalName: hospital?.name || preselectedHospitalName || 'Unknown',
      quantity,
      urgency,
      note,
      unit: preselectedResource?.unit || 'units',
    };
    onSubmit(newTxn);
    setSuccess(true);
    setTxnId(id);
  };

  if (!isOpen) return null;

  if (success) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-success-light rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Request Submitted!</h3>
          <p className="text-sm text-gray-500 mb-4">Your resource request has been created successfully.</p>
          <div className="bg-gray-50 rounded-lg p-3 mb-6">
            <p className="text-xs text-gray-500 mb-1">Transaction ID</p>
            <p className="text-sm font-mono font-semibold text-gray-900">{txnId}</p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Request Resource</h3>
            <p className="text-sm text-gray-500 mt-0.5">Fill in the details to request a clinical resource.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Resource Type</label>
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">Select resource type</option>
              {['ICU Beds', 'Blood', 'Ventilators', 'Oxygen', 'Ambulances'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Hospital</label>
            <select
              value={hospitalId}
              onChange={(e) => setHospitalId(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">Select hospital</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>{h.name} - {h.location}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Urgency Level</label>
            <div className="grid grid-cols-3 gap-2">
              {urgencyLevels.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setUrgency(level.value as Transaction['urgency'])}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${urgency === level.value
                      ? `${level.bg} ${level.color} border-current`
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Note (Optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add any relevant details..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 transition-colors shadow-sm"
            >
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
