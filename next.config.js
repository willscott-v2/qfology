/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // GitHub Pages serves from /qfology subdirectory
  basePath: '/qfology',
  assetPrefix: '/qfology/',
}

module.exports = nextConfig
