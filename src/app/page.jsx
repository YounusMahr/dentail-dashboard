import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { loadClinicSite } from '@/lib/clinic-site-data';
import { brandingUrls } from '@/lib/clinic-profile.mjs';
import PublicSite from './clinic/[slug]/public-site';
import './clinic/[slug]/clinic-site.css';

const homeClinic = process.env.MANAGED_CLINIC_SLUG || 'zentra';

export async function generateMetadata() {
  await connection();
  const data = await loadClinicSite(homeClinic);
  if (!data) return { title: 'Clinic not found' };
  const home = data.website.pages.home;
  return {
    title: `${home.title} | ${data.clinic.name}`,
    description: home.description,
    icons: { icon: brandingUrls(data.clinic).faviconUrl || '/dentalcare-icon.svg' },
  };
}

export default async function Home() {
  await connection();
  const data = await loadClinicSite(homeClinic);
  if (!data) notFound();
  return <PublicSite data={data} pageKey="home" rootAlias />;
}
