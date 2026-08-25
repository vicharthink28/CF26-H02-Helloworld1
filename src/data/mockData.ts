import type { Hospital, Resource, Transaction } from '../types';

export const hospitals: Hospital[] = [
  { id: 'h1', name: 'AIIMS Delhi', location: 'New Delhi, Delhi', contact: '+91-11-2658-8500', type: 'Central Government' },
  { id: 'h2', name: 'Apollo Hospitals', location: 'Chennai, Tamil Nadu', contact: '+91-44-2829-8200', type: 'Private' },
  { id: 'h3', name: 'Fortis Escorts', location: 'Gurgaon, Haryana', contact: '+91-124-665-2000', type: 'Private' },
  { id: 'h4', name: 'KEM Hospital', location: 'Mumbai, Maharashtra', contact: '+91-22-2413-6051', type: 'Government' },
  { id: 'h5', name: 'Narayana Health', location: 'Bangalore, Karnataka', contact: '+91-80-7122-2222', type: 'Private' },
];

// Phase-2 fields: capacity (0 = uncapped), version (optimistic concurrency seed)
export const resources: Resource[] = [
  // ICU Beds
  { id: 'r1', type: 'ICU Beds', hospitalId: 'h1', quantity: 12, capacity: 0, status: 'available', lastUpdated: '2026-08-24T03:15:00+05:30', unit: 'beds', version: 0 },
  { id: 'r2', type: 'ICU Beds', hospitalId: 'h2', quantity: 3, capacity: 0, status: 'critical', lastUpdated: '2026-08-24T02:45:00+05:30', unit: 'beds', version: 0 },
  { id: 'r3', type: 'ICU Beds', hospitalId: 'h3', quantity: 8, capacity: 0, status: 'available', lastUpdated: '2026-08-24T01:30:00+05:30', unit: 'beds', version: 0 },
  { id: 'r4', type: 'ICU Beds', hospitalId: 'h4', quantity: 2, capacity: 0, status: 'critical', lastUpdated: '2026-08-24T03:00:00+05:30', unit: 'beds', version: 0 },
  { id: 'r5', type: 'ICU Beds', hospitalId: 'h5', quantity: 15, capacity: 0, status: 'available', lastUpdated: '2026-08-24T00:20:00+05:30', unit: 'beds', version: 0 },
  // Blood
  { id: 'r6', type: 'Blood', hospitalId: 'h1', quantity: 450, capacity: 0, status: 'available', lastUpdated: '2026-08-24T02:00:00+05:30', unit: 'units', version: 0 },
  { id: 'r7', type: 'Blood', hospitalId: 'h2', quantity: 120, capacity: 0, status: 'low', lastUpdated: '2026-08-24T01:45:00+05:30', unit: 'units', version: 0 },
  { id: 'r8', type: 'Blood', hospitalId: 'h3', quantity: 280, capacity: 0, status: 'available', lastUpdated: '2026-08-24T03:10:00+05:30', unit: 'units', version: 0 },
  { id: 'r9', type: 'Blood', hospitalId: 'h4', quantity: 85, capacity: 0, status: 'low', lastUpdated: '2026-08-24T02:30:00+05:30', unit: 'units', version: 0 },
  { id: 'r10', type: 'Blood', hospitalId: 'h5', quantity: 320, capacity: 0, status: 'available', lastUpdated: '2026-08-24T00:50:00+05:30', unit: 'units', version: 0 },
  // Ventilators
  { id: 'r11', type: 'Ventilators', hospitalId: 'h1', quantity: 8, capacity: 0, status: 'available', lastUpdated: '2026-08-24T02:15:00+05:30', unit: 'units', version: 0 },
  { id: 'r12', type: 'Ventilators', hospitalId: 'h2', quantity: 1, capacity: 0, status: 'critical', lastUpdated: '2026-08-24T01:00:00+05:30', unit: 'units', version: 0 },
  { id: 'r13', type: 'Ventilators', hospitalId: 'h3', quantity: 5, capacity: 0, status: 'available', lastUpdated: '2026-08-24T03:05:00+05:30', unit: 'units', version: 0 },
  { id: 'r14', type: 'Ventilators', hospitalId: 'h4', quantity: 2, capacity: 0, status: 'low', lastUpdated: '2026-08-24T02:20:00+05:30', unit: 'units', version: 0 },
  { id: 'r15', type: 'Ventilators', hospitalId: 'h5', quantity: 10, capacity: 0, status: 'available', lastUpdated: '2026-08-24T00:10:00+05:30', unit: 'units', version: 0 },
  // Oxygen
  { id: 'r16', type: 'Oxygen', hospitalId: 'h1', quantity: 500, capacity: 0, status: 'available', lastUpdated: '2026-08-24T02:00:00+05:30', unit: 'cylinders', version: 0 },
  { id: 'r17', type: 'Oxygen', hospitalId: 'h2', quantity: 80, capacity: 0, status: 'low', lastUpdated: '2026-08-24T01:30:00+05:30', unit: 'cylinders', version: 0 },
  { id: 'r18', type: 'Oxygen', hospitalId: 'h3', quantity: 200, capacity: 0, status: 'available', lastUpdated: '2026-08-24T03:00:00+05:30', unit: 'cylinders', version: 0 },
  { id: 'r19', type: 'Oxygen', hospitalId: 'h4', quantity: 45, capacity: 0, status: 'critical', lastUpdated: '2026-08-24T02:45:00+05:30', unit: 'cylinders', version: 0 },
  { id: 'r20', type: 'Oxygen', hospitalId: 'h5', quantity: 350, capacity: 0, status: 'available', lastUpdated: '2026-08-24T00:30:00+05:30', unit: 'cylinders', version: 0 },
  // Ambulances
  { id: 'r21', type: 'Ambulances', hospitalId: 'h1', quantity: 6, capacity: 0, status: 'available', lastUpdated: '2026-08-24T01:00:00+05:30', unit: 'units', version: 0 },
  { id: 'r22', type: 'Ambulances', hospitalId: 'h2', quantity: 2, capacity: 0, status: 'low', lastUpdated: '2026-08-24T00:45:00+05:30', unit: 'units', version: 0 },
  { id: 'r23', type: 'Ambulances', hospitalId: 'h3', quantity: 4, capacity: 0, status: 'available', lastUpdated: '2026-08-24T02:30:00+05:30', unit: 'units', version: 0 },
  { id: 'r24', type: 'Ambulances', hospitalId: 'h4', quantity: 1, capacity: 0, status: 'critical', lastUpdated: '2026-08-24T02:00:00+05:30', unit: 'units', version: 0 },
  { id: 'r25', type: 'Ambulances', hospitalId: 'h5', quantity: 8, capacity: 0, status: 'available', lastUpdated: '2026-08-24T00:00:00+05:30', unit: 'units', version: 0 },
];

// Phase-2 fields: previousStatus, performedBy
export const initialTransactions: Transaction[] = [
  {
    id: 'TXN-20260824-001', resourceId: 'r2', resourceType: 'ICU Beds',
    hospitalId: 'h2', hospitalName: 'Apollo Hospitals',
    quantity: 2, urgency: 'urgent', note: 'Patient from road accident needs ICU',
    status: 'approved', previousStatus: 'requested', performedBy: 'system',
    createdAt: '2026-08-24T01:00:00+05:30', unit: 'beds',
  },
  {
    id: 'TXN-20260824-002', resourceId: 'r4', resourceType: 'ICU Beds',
    hospitalId: 'h4', hospitalName: 'KEM Hospital',
    quantity: 3, urgency: 'emergency', note: 'COVID patients requiring immediate ICU',
    status: 'in_transit', previousStatus: 'approved', performedBy: 'system',
    createdAt: '2026-08-24T00:30:00+05:30', unit: 'beds',
  },
  {
    id: 'TXN-20260824-003', resourceId: 'r12', resourceType: 'Ventilators',
    hospitalId: 'h2', hospitalName: 'Apollo Hospitals',
    quantity: 1, urgency: 'urgent', note: 'Respiratory failure patient',
    status: 'requested', previousStatus: '', performedBy: 'system',
    createdAt: '2026-08-24T02:00:00+05:30', unit: 'units',
  },
  {
    id: 'TXN-20260824-004', resourceId: 'r17', resourceType: 'Oxygen',
    hospitalId: 'h2', hospitalName: 'Apollo Hospitals',
    quantity: 20, urgency: 'routine', note: 'Regular supply replenishment',
    status: 'completed', previousStatus: 'in_transit', performedBy: 'system',
    createdAt: '2026-08-24T00:00:00+05:30', unit: 'cylinders',
  },
  {
    id: 'TXN-20260824-005', resourceId: 'r9', resourceType: 'Blood',
    hospitalId: 'h4', hospitalName: 'KEM Hospital',
    quantity: 10, urgency: 'urgent', note: 'Blood bank running low on O+',
    status: 'in_transit', previousStatus: 'approved', performedBy: 'system',
    createdAt: '2026-08-23T23:00:00+05:30', unit: 'units',
  },
  {
    id: 'TXN-20260824-006', resourceId: 'r24', resourceType: 'Ambulances',
    hospitalId: 'h4', hospitalName: 'KEM Hospital',
    quantity: 1, urgency: 'routine', note: 'Scheduled patient transfer',
    status: 'requested', previousStatus: '', performedBy: 'system',
    createdAt: '2026-08-24T02:30:00+05:30', unit: 'units',
  },
];
