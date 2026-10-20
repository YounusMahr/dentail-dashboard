export const modules = {
  patients: { title: 'Patients', roles: ['clinic_admin', 'receptionist', 'dentist'], fields: [
    ['name', 'Name', 'text', true], ['phone', 'Phone', 'tel', true], ['email', 'Email', 'email'], ['dateOfBirth', 'Date of birth', 'date'],
    ['whatsappConsent','Patient agreed to WhatsApp notifications','checkbox'], ['preferredLanguage','Message language','select:en,ur'], ['gender', 'Gender', 'select:male,female,other'], ['bloodGroup', 'Blood group', 'text'], ['address', 'Address', 'text'], ['medicalHistory', 'Medical history', 'textarea']
  ] },
  services: { title: 'Dental services', roles: ['clinic_admin', 'receptionist', 'dentist'], writeRoles: ['clinic_admin'], fields: [
    ['name', 'Name', 'text', true], ['category', 'Category', 'text'], ['description', 'Description', 'textarea'], ['standardFee', 'Fee (PKR)', 'number', true],
    ['durationMinutes', 'Duration (minutes)', 'number', true], ['active', 'Active', 'checkbox']
  ] },
  doctors: { title: 'Doctors', roles: ['clinic_admin', 'receptionist', 'dentist'], writeRoles: ['clinic_admin'], fields: [
    ['name', 'Name', 'text', true], ['email', 'Email', 'email', true], ['phone', 'Phone', 'tel'], ['specialization', 'Specialization', 'text'],
    ['consultationFee', 'Consultation fee', 'number'], ['slotMinutes', 'Slot duration', 'number'], ['workingDays', 'Working days (comma separated)', 'text'],
    ['startTime', 'Start time', 'time'], ['endTime', 'End time', 'time'], ['breakStart', 'Break start', 'time'], ['breakEnd', 'Break end', 'time'], ['active', 'Active', 'checkbox']
  ] },
  treatments: { title: 'Treatments', roles: ['clinic_admin', 'receptionist', 'dentist'], writeRoles: ['clinic_admin', 'dentist'], fields: [
    ['patientId', 'Patient', 'patient', true], ['doctorId', 'Doctor', 'doctor', true], ['serviceId', 'Service', 'service'], ['toothNumbers', 'FDI tooth numbers', 'teeth'],
    ['diagnosis', 'Diagnosis', 'textarea', true], ['treatmentRendered', 'Treatment', 'textarea', true], ['clinicalNotes', 'Confidential notes', 'textarea'], ['prescription', 'Prescription', 'textarea']
  ] },
  'follow-ups': { title: 'Follow-ups', roles: ['clinic_admin', 'receptionist', 'dentist'], fields: [
    ['patientId', 'Patient', 'patient', true], ['dueDate', 'Due date', 'date', true], ['reason', 'Reason', 'text', true],
    ['status', 'Status', 'select:pending,contacted,booked,cancelled'], ['staffNotes', 'Staff notes', 'textarea']
  ] },
  appointments: { title: 'Appointments', roles: ['clinic_admin', 'receptionist', 'dentist'], fields: [
    ['patientId', 'Patient', 'patient', true], ['doctorId', 'Doctor', 'doctor', true], ['serviceId', 'Service', 'service'],
    ['appointmentDate', 'Date', 'date', true], ['startsAt', 'Time', 'time', true], ['status', 'Status', 'select:pending,confirmed,checked_in,in_progress,completed,cancelled,no_show'], ['patientNotes', 'Notes', 'textarea']
  ] },
  invoices: { title: 'Invoices', roles: ['clinic_admin', 'receptionist', 'dentist'], writeRoles: ['clinic_admin', 'receptionist'], fields: [
    ['patientId', 'Patient', 'patient', true], ['description', 'Item description', 'text', true], ['quantity', 'Quantity', 'number', true],
    ['unitPrice', 'Unit price', 'number', true], ['discountAmount', 'Discount', 'number'], ['dueDate', 'Due date', 'date']
  ] },
  staff: { title: 'Staff', roles: ['clinic_admin'], fields: [
    ['name', 'Name', 'text', true], ['email', 'Email', 'email', true], ['phone', 'Phone', 'tel'], ['role', 'Role', 'select:receptionist,dentist,clinic_admin', true], ['password', 'Password', 'password'], ['active', 'Active', 'checkbox']
  ] },
};
