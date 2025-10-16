import type { NextConfig } from "next";
import path from "node:path";

const LOADER = path.resolve(__dirname, 'src/visual-edits/component-tagger-loader.js');

const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

const nextConfig: NextConfig = {
  // Добавляем поддержку для Capacitor
  output: isCapacitorBuild ? 'export' : undefined,
  images: {
    unoptimized: isCapacitorBuild,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Rewrites не поддерживаются при static export
  ...(!isCapacitorBuild && {
    async rewrites() {
      return [
        { source: "/icon-512.png", destination: "/api/icons/512" },
        { source: "/icon-192.png", destination: "/api/icons/192" },
      ]
    },
  }),
  turbopack: {
    rules: {
      "*.{jsx,tsx}": {
        loaders: [LOADER]
      }
    }
  }
};

export default nextConfig;
// Orchids restart: 1760642098844