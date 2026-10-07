// Le navigateur n'appelle que ce domaine : /api et /media sont relayés vers le backend
// par le réseau Docker interne. Pas de CORS, pas d'URL d'API à exposer côté client.
const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

/** @type {import('next').NextConfig} */
export default {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/media/:path*", destination: `${BACKEND_URL}/media/:path*` },
    ];
  },
};
