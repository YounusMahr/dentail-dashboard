import { MongoClient } from 'mongodb';

let clientPromise;
let indexesPromise;
export async function db() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing');
  if (!clientPromise) clientPromise = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 }).connect();
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || 'dentists');
}

export async function ensureIndexes() {
  const database = await db();
  if (!indexesPromise) indexesPromise=Promise.all([
    database.collection('notificationOutbox').createIndex({clinicId:1,eventKey:1},{unique:true}),
    database.collection('emailOutbox').createIndex({clinicId:1,eventKey:1},{unique:true}),
    database.collection('users').createIndex({ email: 1 }, { unique: true }),
    database.collection('clinics').createIndex({ slug: 1 }, { unique: true }),
    database.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection('appointments').createIndex(
      { clinicId: 1, doctorId: 1, appointmentDate: 1, startsAt: 1 },
      { unique: true, partialFilterExpression: { status: { $in: ['pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'no_show'] } } }
    ),
    database.collection('appointments').createIndex({clinicId:1,chairName:1,appointmentDate:1,startsAt:1},{unique:true,partialFilterExpression:{chairName:{$gt:''},status:{$in:['pending','confirmed','checked_in','in_progress','completed']}}}),
    database.collection('patients').createIndex({ clinicId: 1, phone: 1 }),
    database.collection('invoices').createIndex({ clinicId: 1, invoiceNumber: 1 }, { unique: true }),
    database.collection('invoices').createIndex({ clinicId: 1, visitInvoiceKey: 1 }, { unique: true, partialFilterExpression: { visitInvoiceKey: { $exists: true } } }),
    database.collection('visitSessions').createIndex({clinicId:1,appointmentId:1},{unique:true}),
    database.collection('prescriptions').createIndex({clinicId:1,appointmentId:1}),
  ]).catch(error=>{indexesPromise=undefined;throw error});
  return indexesPromise;
}
