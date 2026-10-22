import { notFound } from 'next/navigation';
import { loadClinicSite } from '@/lib/clinic-site-data';
import { brandingUrls } from '@/lib/clinic-profile.mjs';
import PublicSite from './public-site';

export async function generateMetadata({ params, searchParams }) {
  const { slug } = await params;
  const preview = (await searchParams).preview === '1';
  const data = await loadClinicSite(slug, preview);
  if (!data) return { title: 'Clinic not found' };
  const home = data.website.pages.home;
  return { title: `${home.title} | ${data.clinic.name}`, description: home.description, icons: { icon: brandingUrls(data.clinic).faviconUrl || '/dentalcare-icon.svg' }, robots: preview ? { index: false, follow: false } : undefined };
}

export default async function ClinicHome({ params, searchParams }) {
  const { slug } = await params;
  const preview = (await searchParams).preview === '1';
  const data = await loadClinicSite(slug, preview);
  if (!data) notFound();
  return <PublicSite data={data} pageKey="home" />;
}
