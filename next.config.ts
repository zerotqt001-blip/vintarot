import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Keep revocable private-derived public share pages out of indexes and shared caches. */
  async headers() {
    return [{
      source: "/r/:path*",
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Cache-Control", value: "private, no-store" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    }];
  },
};

export default nextConfig;
