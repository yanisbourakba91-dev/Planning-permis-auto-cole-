import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
};

// L'adaptateur @vercel/next est requis pour Next.js 16 sur Vercel.
// @vercel/build-utils n'existe que dans l'environnement de build Vercel,
// donc on ne le charge que là.
if (process.env.VERCEL) {
  nextConfig.adapterPath = require.resolve("@vercel/next/dist/adapter");
}

export default nextConfig;
