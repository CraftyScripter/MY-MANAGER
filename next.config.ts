import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.1.43',
    'polar-ease-citations-brokers.trycloudflare.com',
    '*.trycloudflare.com',
  ],
};

export default nextConfig;
