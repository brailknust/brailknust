import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["officeparser"],
  experimental: {
    // Course materials allow 50MB files. Multipart boundaries and the other
    // form fields add a little overhead beyond the file itself.
    proxyClientMaxBodySize: "52mb",
    // Keep recently visited dynamic page payloads in the browser briefly so
    // moving back and forth through the workspace does not repeat the same
    // server round trips. Server actions already revalidate affected paths.
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
};

export default nextConfig;
