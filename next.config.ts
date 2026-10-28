import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Demo 100 % cliente (datos en localStorage): sin cacheComponents para evitar
  // requerir Suspense en cada acceso a parámetros de ruta.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
