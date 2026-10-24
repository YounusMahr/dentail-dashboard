import test from 'node:test';
import assert from 'node:assert/strict';
import { patientDeletionStatus } from '../src/lib/patient-deletion-check.js';

function databaseWith({ appointments = 0, removed = [], linked = [], invoices = [], prescriptions = [], sessions = [] } = {}) {
  return {
    collection(name) {
      return {
        countDocuments: async () => name === 'appointments' ? appointments : 0,
        findOne: async () => linked.includes(name) ? { _id: name } : null,
        find: () => ({ toArray: async () => ({ appointments: removed.map(_id => ({ _id })), invoices, prescriptions, visitSessions: sessions })[name] || [] }),
      };
    },
  };
}

test('patient with appointments cannot be deleted', async () => {
  assert.deepEqual(await patientDeletionStatus(databaseWith({ appointments: 2 }), 'clinic', 'patient'), {
    canDelete: false, reason: 'appointments', appointments: 2, removableAppointmentIds: [],
  });
});

test('patient history blocks deletion after appointments are removed', async () => {
  const status = await patientDeletionStatus(databaseWith({ invoices: [{ appointmentId: 'visit-1', status: 'unpaid', paidAmount: 0 }] }), 'clinic', 'patient');
  assert.equal(status.canDelete, false);
  assert.equal(status.reason, 'records');
});

test('removed unused booking can be cleaned up with the patient', async () => {
  const status = await patientDeletionStatus(databaseWith({
    removed: ['visit-1'],
    invoices: [{ appointmentId: 'visit-1', status: 'cancelled', paidAmount: 0 }],
    prescriptions: [{ appointmentId: 'visit-1', status: 'draft', medications: [] }],
    sessions: [{ appointmentId: 'visit-1', status: 'cancelled' }],
  }), 'clinic', 'patient');
  assert.equal(status.canDelete, true);
  assert.deepEqual(status.removableAppointmentIds, ['visit-1']);
});

test('paid or issued care records still block deletion', async () => {
  const database = databaseWith({ removed: ['visit-1'], invoices: [{ appointmentId: 'visit-1', status: 'cancelled', paidAmount: 500 }] });
  assert.equal((await patientDeletionStatus(database, 'clinic', 'patient')).canDelete, false);
  const issued = databaseWith({ removed: ['visit-1'], prescriptions: [{ appointmentId: 'visit-1', status: 'issued' }] });
  assert.equal((await patientDeletionStatus(issued, 'clinic', 'patient')).canDelete, false);
});

test('patient without linked records can be deleted', async () => {
  const status = await patientDeletionStatus(databaseWith(), 'clinic', 'patient');
  assert.equal(status.canDelete, true);
  assert.equal(status.reason, null);
});
