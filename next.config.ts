import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['192.168.3.72'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@base-ui/react', 'sonner'],
  },
};

export default withNextIntl(nextConfig);

