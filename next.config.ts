/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // you already skipped lint in CI, keep it here so local `next build` doesn’t choke
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 🚨 skips tsc entirely ─ build will succeed even with red squiggles
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
