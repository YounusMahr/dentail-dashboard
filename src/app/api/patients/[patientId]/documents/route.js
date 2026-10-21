import { ObjectId, GridFSBucket } from 'mongodb';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, id, ok, string } from '@/lib/http';
import { writeBlock } from '@/lib/clinic-access';

export async function GET(request, { params }) {
  const user = await currentUser(), patientId = (await params).patientId;
  if (!user?.clinicId || !id(patientId)) return fail('Unauthorized', 401);
  const database = await db();
  if (!await database.collection('patients').findOne({ _id: new ObjectId(patientId), clinicId: user.clinicId })) return fail('Patient not found', 404);
  const documents = await database.collection('patientDocuments').find({ clinicId: user.clinicId, patientId }, { projection: { fileId: 0 } }).sort({ createdAt: -1 }).toArray();
  return ok({ documents });
}

export async function POST(request, { params }) {
  const user = await currentUser(), patientId = (await params).patientId;
  if (!sameOrigin(request) || !['clinic_admin', 'dentist'].includes(user?.role) || !id(patientId)) return fail('Unauthorized', 403);
  const block = await writeBlock(user); if (block) return fail(block, 403);
  const database = await db();
  if (!await database.collection('patients').findOne({ _id: new ObjectId(patientId), clinicId: user.clinicId })) return fail('Patient not found', 404);
  const form = await request.formData(), file = form.get('file');
  if (!file || typeof file === 'string' || file.size < 1 || file.size > 15 * 1024 * 1024 || !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) return fail('Use a JPEG, PNG or PDF under 15 MB');
  if(!['xray','lab_report','photo','consent_form','prescription','other'].includes(String(form.get('documentType')||'other')))return fail('Invalid document type');
  const toothNumbers=string(form.get('toothNumbers'),100);if(toothNumbers&&!toothNumbers.split(/[\s,]+/).every(n=>/^[1-8][1-8]$/.test(n)&&(+n[0]<5||+n[1]<=5)))return fail('Invalid FDI tooth numbers');
  const bucket = new GridFSBucket(database, { bucketName: 'clinicalFiles' });
  const fileId = new ObjectId(), filename = `${user.clinicId}/${patientId}/${fileId}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const signatures = {
    'image/jpeg': bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
    'image/png': bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
    'application/pdf': bytes.length >= 5 && bytes.subarray(0, 5).toString() === '%PDF-'
  };
  if (!signatures[file.type]) return fail('File content does not match its type');
  await new Promise((resolve, reject) => { const stream = bucket.openUploadStreamWithId(fileId, filename, { contentType: file.type }); stream.on('finish', resolve).on('error', reject); stream.end(bytes); });
  let result;
  try { result = await database.collection('patientDocuments').insertOne({ clinicId: user.clinicId, patientId, fileId, toothNumbers, notes:string(form.get('notes'),1000), title: string(form.get('title'), 150) || file.name.slice(0, 150), documentType: string(form.get('documentType'), 40) || 'other', fileName: file.name.slice(0, 200), fileSize: file.size, mimeType: file.type, uploadedByUserId: String(user._id), createdAt: new Date() }); }
  catch (error) { await bucket.delete(fileId); throw error; }
  return ok({ id: String(result.insertedId) }, 201);
}
