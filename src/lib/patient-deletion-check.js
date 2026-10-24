const protectedCollections = ['treatments', 'payments', 'follow-ups', 'patientDocuments', 'treatmentPlans', 'careSessions', 'labCases', 'waitingList', 'portalAccess'];

export async function patientDeletionStatus(database, clinicId, patientId, session) {
  const query = { clinicId, patientId };
  const options = session ? { session } : {};
  const appointments = await database.collection('appointments').countDocuments({ ...query, deletedAt: { $exists: false } }, options);
  if (appointments) return { canDelete: false, reason: 'appointments', appointments, removableAppointmentIds: [] };

  const removed = await database.collection('appointments').find({ ...query, deletedAt: { $exists: true } }, { projection: { _id: 1 }, ...options }).toArray();
  const removableAppointmentIds = removed.map(item => String(item._id));
  const linked = [];
  if (session) {
    for (const name of protectedCollections) linked.push(await database.collection(name).findOne(query, { projection: { _id: 1 }, ...options }));
  } else linked.push(...await Promise.all(protectedCollections.map(name => database.collection(name).findOne(query, { projection: { _id: 1 } }))));
  const loadInvoices = () => database.collection('invoices').find(query, { projection: { appointmentId: 1, status: 1, paidAmount: 1 }, ...options }).toArray();
  const loadPrescriptions = () => database.collection('prescriptions').find(query, { projection: { appointmentId: 1, status: 1, diagnosis: 1, instructionsEn: 1, instructionsUr: 1, reviewDate: 1, medications: 1 }, ...options }).toArray();
  const loadSessions = () => database.collection('visitSessions').find(query, { projection: { appointmentId: 1, status: 1 }, ...options }).toArray();
  let invoices, prescriptions, sessions;
  if (session) {
    invoices = await loadInvoices();
    prescriptions = await loadPrescriptions();
    sessions = await loadSessions();
  } else [invoices, prescriptions, sessions] = await Promise.all([loadInvoices(), loadPrescriptions(), loadSessions()]);
  const belongsToRemovedVisit = item => removableAppointmentIds.includes(String(item.appointmentId || ''));
  const hasHistory = linked.some(Boolean)
    || invoices.some(item => !belongsToRemovedVisit(item) || item.status !== 'cancelled' || Number(item.paidAmount || 0) !== 0)
    || prescriptions.some(item => !belongsToRemovedVisit(item) || item.status !== 'draft' || item.diagnosis || item.instructionsEn || item.instructionsUr || item.reviewDate || item.medications?.length)
    || sessions.some(item => !belongsToRemovedVisit(item) || item.status !== 'cancelled');
  return { canDelete: !hasHistory, reason: hasHistory ? 'records' : null, appointments: 0, removableAppointmentIds };
}
