import './globals.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
export const metadata = {
  title: 'DentalCare',
  description: 'Dental clinic management',
  applicationName: 'DentalCare',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'DentalCare' },
  icons: { icon: '/dentalcare-icon.svg', apple: '/pwa/apple-touch-icon.png' },
};
export const viewport = { themeColor: '#0e8f7c' };
export default function RootLayout({ children }) { return <html lang="en"><body>{children}</body></html>; }
