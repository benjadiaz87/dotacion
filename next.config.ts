import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite acceder al dev server desde el teléfono en la red local
  allowedDevOrigins: ["192.168.0.129", "192.168.0.*"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
