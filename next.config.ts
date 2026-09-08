import type { NextConfig } from "next";

// The Word add-in task pane (app/addin/word) is served over https (Office refuses http) and
// reaches the backend through this same-origin rewrite: no cross-origin fetch, no mixed
// content inside Word's webview. Locally BACKEND_URL points at the dev backend; on Vercel
// it is unset and the Railway backend is used.
const BACKEND_URL = process.env.BACKEND_URL || "https://backendfornextapp-production.up.railway.app";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/backend/:path*", destination: `${BACKEND_URL}/:path*` }];
  },
};

export default nextConfig;
