import { ObjectId, GridFSBucket } from 'mongodb';
import { Readable } from 'node:stream';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fail, id, ok } from '@/lib/http';
import { writeBlock } from '@/lib/clinic-access';

async function find(user, patientId, documentId) {
  if (!user?.clinicId || !id(patientId) || !id(documentId)) return null;
  const database = await db();
  const document = await database.collection('patientDocuments').findOne({ _id: new ObjectId(documentId), clinicId: user.clinicId, patientId });
  return document ? { database, document } : null;
}
export async function GET(request, { params }) {
  const { patientId, documentId } = await params, result = await find(await currentUser(), patientId, documentId);
  if (!result) return fail('Not found', 404);
  const stream = new GridFSBucket(result.database, { bucketName: 'clinicalFiles' }).openDownloadStream(result.document.fileId);
  return new Response(Readable.toWeb(stream), { headers: { 'Content-Type': result.document.mimeType, 'Content-Disposition': `attachment; filename="${result.document.fileName.replace(/["\r\n]/g, '')}"`, 'Cache-Control': 'private, no-store' } });
}
export async function DELETE(request, { params }) {
  const user = await currentUser(), { patientId, documentId } = await params;
  if (!sameOrigin(request) || !['clinic_admin', 'dentist'].includes(user?.role)) return fail('Unauthorized', 403);
  const block = await writeBlock(user); if (block) return fail(block, 403);
  const result = await find(user, patientId, documentId);
  if (!result) return fail('Not found', 404);
  await new GridFSBucket(result.database, { bucketName: 'clinicalFiles' }).delete(result.document.fileId);
  await result.database.collection('patientDocuments').deleteOne({ _id: result.document._id, clinicId: user.clinicId });
  return ok({ success: true });
}
