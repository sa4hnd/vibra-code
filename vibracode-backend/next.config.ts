import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has TypeScript errors.
    ignoreBuildErrors: true,
  },
  // Disable error overlay in production
  devIndicators: false,
  // Allow cross-origin requests from your production domain
  allowedDevOrigins: ["https://www.vibracodeapp.com", "https://vibracodeapp.com"],
  // Set body size limit for API routes (50MB to support multiple images)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Configure API routes body size limit
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default nextConfig;
