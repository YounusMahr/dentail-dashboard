import { db } from '@/lib/db';

export async function GET() {
  if (process.env.MANAGED_CLINIC !== 'true' || !process.env.MANAGED_CLINIC_SLUG || !process.env.MONGODB_DB) return Response.json({ error: 'Managed clinic identity and database are not configured' }, { status: 503 });
  const slug = process.env.MANAGED_CLINIC_SLUG;
  const clinic = await (await db()).collection('clinics').findOne({ slug }, { projection: { name: 1, slug: 1, phone: 1, address: 1, email: 1, logoVersion: 1 } });
  const name = clinic?.name || process.env.MANAGED_CLINIC_NAME;
  if (!name) return Response.json({ error: 'Set MANAGED_CLINIC_NAME on this clinic deployment, or create its clinic profile first' }, { status: 404 });
  return Response.json({ clinic: { name, slug, phone: clinic?.phone || '', address: clinic?.address || '', email: clinic?.email || '', logoUrl: clinic?.logoVersion ? `/api/clinic-brand/${clinic._id}/logo?v=${clinic.logoVersion}` : null } }, { headers: { 'Cache-Control': 'no-store' } });
}
