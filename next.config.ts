import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const iconVersion = createHash("sha256");
for (const name of ["mark.svg", "logo.svg", "icon-192.png", "icon-512.png"]) {
  iconVersion.update(readFileSync(join(process.cwd(), "public/icons", name)));
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: { NEXT_PUBLIC_BRAND_ICON_VERSION: iconVersion.digest("hex").slice(0, 16) },
  async headers() {
    return [{ source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }] }];
  },
  devIndicators: false,
  experimental: { cpus: 2 },
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
