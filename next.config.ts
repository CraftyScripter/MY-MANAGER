import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.1.43',
    'polar-ease-citations-brokers.trycloudflare.com',
    '*.trycloudflare.com',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
