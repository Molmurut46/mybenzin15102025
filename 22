import type { NextConfig } from "next";
import path from "node:path";

// const LOADER = path.resolve(__dirname, 'src/visual-edits/component-tagger-loader.js');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Remove unsupported Turbopack custom loader config causing build failures in Next 15
  // turbopack: {
  //   rules: {
  //     "*.{jsx,tsx}": {
  //       loaders: [LOADER]
  //     }
  //   }
  // }
  async rewrites() {
    return [
      { source: "/icon-512.png", destination: "/api/icons/512" },
      { source: "/icon-192.png", destination: "/api/icons/192" },
    ]
  },
};

export default nextConfig;
// Orchids restart: 1760617740738