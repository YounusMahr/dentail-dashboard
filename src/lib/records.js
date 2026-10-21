import { cleanPatientPhoto } from './patient-photo.mjs';
import { ObjectId } from 'mongodb';
import { modules } from './modules';
import { db, ensureIndexes } from './db';
import { writeBlock } from './clinic-access';
import { money } from './care-validation.mjs';

const refCollections = { patientId: 'patients', doctorId: 'doctors', serviceId: 'services' };
const numeric = new Set(['standardFee', 'durationMinutes', 'consultationFee', 'slotMinutes', 'quantity', 'unitPrice', 'discountAmount']);

export async function cleanRecord(module, input, user, existing = null) {
  const schema = modules[module];
  if (!schema) throw new Error('Unknown module');
  const database = await db(), record = {};
  const block = await writeBlock(user);
  if (block) throw new Error(block);
  if (!existing && ['patients', 'doctors', 'staff'].includes(module)) {
    const subscription = await database.collection('subscriptions').findOne({ clinicId: user.clinicId }, { sort: { createdAt: -1 } });
    const plan = await database.collection('subscriptionPlans').findOne({ slug: subscription?.plan || 'starter' });
    const limits = plan ? { patients: Number(plan.maxPatients), doctors: Number(plan.maxDoctors), staff: Number(plan.maxStaff) } : { patients: 200, doctors: 1, staff: 2 };
    const count = await database.collection(module === 'staff' ? 'users' : module).countDocuments({ clinicId: user.clinicId });
    if (count >= limits[module]) throw new Error(`${module} limit reached for this plan`);
  }
  for (const [key, , type, required] of schema.fields) {
    if (!(key in input)) continue;
    let value = input[key];
    if (type === 'checkbox') value = value === true;
    else if (numeric.has(key)) value = Number(value);
    else value = String(value ?? '').trim();
    if (numeric.has(key) && (!Number.isFinite(value) || value < 0 || ['durationMinutes','slotMinutes','quantity'].includes(key) && value < 1)) throw new Error(`Invalid ${key}`);
    if (required && (value === '' || value === null)) throw new Error(`${key} is required`);
    if (type === 'email' && value && !/^\S+@\S+\.\S+$/.test(value)) throw new Error(`Invalid ${key}`);
    if (type.startsWith('select:') && value && !type.slice(7).split(',').includes(value)) throw new Error(`Invalid ${key}`);
    if (type === 'date' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid ${key}`);
    if (type === 'time' && value && !/^\d{2}:\d{2}$/.test(value)) throw new Error(`Invalid ${key}`);
    if (typeof value === 'string' && value.length > (type === 'textarea' ? 4000 : 500)) throw new Error(`${key} is too long`);
    if (refCollections[key] && value) {
      if (!ObjectId.isValid(value) || !await database.collection(refCollections[key]).findOne({ _id: new ObjectId(value), clinicId: user.clinicId })) throw new Error(`Invalid ${key}`);
    }
    record[key] = value;
  }
  if (!existing) for (const [key, , , required] of schema.fields) if (required && !(module === 'invoices' && ['description','quantity','unitPrice'].includes(key) && Array.isArray(input.items)) && (record[key] === undefined || record[key] === '')) throw new Error(`${key} is required`);
  if (module === 'treatments' && user.role === 'dentist') record.doctorId = user.doctorId;
  if (module === 'doctors') {
    if (record.slotMinutes !== undefined && (record.slotMinutes < 10 || record.slotMinutes > 180)) throw new Error('Slot duration must be 10–180 minutes');
    if (!existing && !('active' in record)) record.active = true;
  }
  if (module === 'staff') {
    if (record.password) { if (record.password.length < 8) throw new Error('Password needs 8 characters'); const { hashPassword } = await import('./auth'); record.passwordHash = hashPassword(record.password); }
    delete record.password;
    if (!existing && !record.passwordHash) throw new Error('Password is required');
    if (record.email) record.email = record.email.toLowerCase();
    if (module === 'staff' && !existing) record.active = true;
  }
  if (module === 'appointments') {
    if (user.role === 'dentist' && (record.doctorId || existing?.doctorId) !== user.doctorId) throw new Error('Dentists can only schedule their own appointments');
    const doctor = await database.collection('doctors').findOne({ _id: new ObjectId(record.doctorId || existing?.doctorId), clinicId: user.clinicId });
    const date = record.appointmentDate || existing?.appointmentDate, time = record.startsAt || existing?.startsAt;
    if (!doctor || !date || !time) throw new Error('Choose doctor, date and time');
    const minutes = Number(doctor.slotMinutes || 30);
    const start = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const end = start + minutes;
    const toMin = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    const first = toMin(doctor.startTime || '10:00'), last = toMin(doctor.endTime || '20:00');
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)).toLowerCase();
    if (doctor.workingDays && !doctor.workingDays.split(',').map(x => x.trim()).includes(day)) throw new Error('Doctor is not scheduled that day');
    if (start < first || end > last || (start - first) % minutes !== 0) throw new Error('Choose an available schedule slot');
    if (doctor.breakStart && doctor.breakEnd && start < toMin(doctor.breakEnd) && end > toMin(doctor.breakStart)) throw new Error('Slot overlaps the doctor break');
    record.endsAt = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
    if (!existing && !record.status) record.status = 'confirmed';
  }
  if (module === 'invoices' && !existing) {
    record.feeType = ['consultation','checkup','treatment'].includes(input.feeType)?input.feeType:'treatment';
    if(input.doctorId){if(!ObjectId.isValid(input.doctorId)||!await database.collection('doctors').findOne({_id:new ObjectId(input.doctorId),clinicId:user.clinicId}))throw new Error('Invalid dentist');record.doctorId=input.doctorId}
    if(record.feeType!=='treatment'&&!record.doctorId)throw new Error('Choose a dentist for consultation / checkup billing');
    const rawItems = Array.isArray(input.items) ? input.items : [{ description: record.description, quantity: record.quantity, unitPrice: record.unitPrice }];
    if (!rawItems.length || rawItems.length > 30) throw new Error('Invoice needs 1–30 items');
    record.items = [];
    for (const item of rawItems) {
      const description = String(item.description || '').trim().slice(0, 200), quantity = Number(item.quantity), unitPrice = money(item.unitPrice);
      if (!description || !Number.isInteger(quantity) || quantity < 1 || !(unitPrice >= 0)) throw new Error('Invalid invoice item');
      let serviceId = '';
      if (item.serviceId) {
        if (!ObjectId.isValid(item.serviceId) || !await database.collection('services').findOne({ _id: new ObjectId(item.serviceId), clinicId: user.clinicId })) throw new Error('Invalid service');
        serviceId = item.serviceId;
      }
      record.items.push({ serviceId, description, quantity, unitPrice, totalPrice: money(quantity * unitPrice) });
    }
    const subtotal = money(record.items.reduce((total, item) => total + item.totalPrice, 0)), discount = money(record.discountAmount || 0);
    if (!(discount >= 0 && discount <= subtotal)) throw new Error('Invalid discount');
    record.description = record.items.map(x => x.description).join(', ').slice(0, 500);
    record.totalAmount = money(subtotal - discount); record.paidAmount = 0; record.balanceAmount = record.totalAmount; record.status = 'unpaid';
    record.invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }
  if(module==='patients'&&Object.hasOwn(input,'photoDataUrl'))record.photoDataUrl=await cleanPatientPhoto(input.photoDataUrl);
  await ensureIndexes();
  return record;
}
