import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { homeClinicSlug, loadClinicSite } from '@/lib/clinic-site-data';
import { brandingUrls } from '@/lib/clinic-profile.mjs';
import PublicSite from '../clinic/[slug]/public-site';
import '../clinic/[slug]/clinic-site.css';

const pages = { 'about-us': 'about', services: 'services', 'contact-us': 'contact' };
export async function generateMetadata({ params }) {
  await connection();
  const { clinicPage } = await params;
  const pageKey = pages[clinicPage];
  if (!pageKey) return { title: 'Page not found' };
  const data = await loadClinicSite(await homeClinicSlug());
  if (!data) return { title: 'Clinic not found' };
  const page = data.website.pages[pageKey];
  return {
    title: `${page.title} | ${data.clinic.name}`,
    description: page.description,
    icons: { icon: brandingUrls(data.clinic).faviconUrl || '/dentalcare-icon.svg' },
  };
}

export default async function ClinicPage({ params }) {
  await connection();
  const { clinicPage } = await params;
  const pageKey = pages[clinicPage];
  if (!pageKey) notFound();
  const data = await loadClinicSite(await homeClinicSlug());
  if (!data) notFound();
  return <PublicSite data={data} pageKey={pageKey} rootAlias />;
}
