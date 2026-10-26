import { db } from '@/lib/db';

export async function GET() {
  const collection = (await db()).collection('clinics');
  const configuredSlug = process.env.MANAGED_CLINIC_SLUG || process.env.PUBLIC_CLINIC_SLUG;
  let clinic = configuredSlug
    ? await collection.findOne({ slug: configuredSlug }, { projection: { name: 1, slug: 1, phone: 1, address: 1, email: 1, logoVersion: 1 } })
    : await collection.findOne({ slug: 'zentra' }, { projection: { name: 1, slug: 1, phone: 1, address: 1, email: 1, logoVersion: 1 } });
  if (!clinic && !configuredSlug) {
    const candidates = await collection.find({}, { projection: { name: 1, slug: 1, phone: 1, address: 1, email: 1, logoVersion: 1 } }).limit(2).toArray();
    if (candidates.length === 1) clinic = candidates[0];
    if (candidates.length > 1) return Response.json({ error: 'More than one clinic uses this database. Set MANAGED_CLINIC_SLUG for this deployment.' }, { status: 409 });
  }
  const slug = clinic?.slug || configuredSlug;
  const name = clinic?.name || process.env.MANAGED_CLINIC_NAME;
  if (!slug || !name) return Response.json({ error: 'Clinic profile not found. Set MANAGED_CLINIC_SLUG and MANAGED_CLINIC_NAME on this clinic deployment.' }, { status: 404 });
  return Response.json({ clinic: { name, slug, phone: clinic?.phone || '', address: clinic?.address || '', email: clinic?.email || '', logoUrl: clinic?.logoVersion ? `/api/clinic-brand/${clinic._id}/logo?v=${clinic.logoVersion}` : null, databaseName: process.env.MONGODB_DB || 'dentists' } }, { headers: { 'Cache-Control': 'no-store' } });
}
