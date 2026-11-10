import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ["@prisma/client"],
  // ============ OPTIMASI UNTUK LOW-END DEVICE ============
  // Hapus console.log/error di production (hemat bundle JS)
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  // Optimasi gambar: convert ke webp + avif otomatis (file size lebih kecil)
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 hari cache di CDN
  },
  // Experimental: tree-shake imports dari lucide-react & radix-ui
  // (shadcn/ui components import icon by name, tapi kalau manual import
  //  bisa bawa seluruh icon set kecuali di-optimize)
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "recharts",
      "date-fns",
    ],
  },
  // Compress response dengan brotli di edge (default Vercel sudah handle, ini untuk self-host)
  compress: true,
  // Powered-by header (buang untuk hemat sedikit byte + security)
  poweredByHeader: false,
};

export default nextConfig;
