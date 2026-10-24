const nextConfig = {
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: { '/api/**': ['./public/fonts/urdu-pdf.ttf'] }
};
export default nextConfig;
