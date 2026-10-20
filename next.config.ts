import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
