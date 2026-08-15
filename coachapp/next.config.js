/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      ],
  },
  async redirects() {
    return [
      {
        source: "/vai",
        destination: "/iscriviti/b341c464-50d6-4ba5-811e-f6652390fbdb/32c8454a-2d34-448e-8300-411133d043c7",
        permanent: false,
      },
      ];
  },
};

module.exports = nextConfig;
