import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["officeparser"],
  experimental: {
    // Course materials allow 50MB files. Multipart boundaries and the other
    // form fields add a little overhead beyond the file itself.
    proxyClientMaxBodySize: "52mb",
  },
};

export default nextConfig;
