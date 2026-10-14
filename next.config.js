/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    // TODO: Remove once Supabase generated types are added.
    // Without generated DB types, Supabase queries return generic types
    // that don't satisfy the app's TypeScript interfaces.
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
