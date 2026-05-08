import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Surface useful info in the build log.
  experimental: {
    typedRoutes: true,
  },
};

export default config;
