export default function manifest() {
  return {
    id: '/dashboard',
    name: 'DentalCare | Clinic Workspace',
    short_name: 'DentalCare',
    description: 'Manage your dental clinic, appointments, patients and care in one workspace.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f8f8',
    theme_color: '#0e8f7c',
    orientation: 'any',
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
