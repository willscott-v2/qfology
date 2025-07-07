/** @type {import('next').NextConfig} */

// Check if we're building for GitHub Pages
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig = {
  // Only use static export for GitHub Pages
  ...(isGitHubPages && {
    output: 'export',
    basePath: '/qfology',
    assetPrefix: '/qfology/',
  }),
  
  // Image configuration based on environment
  images: {
    unoptimized: isGitHubPages, // Only disable optimization for GitHub Pages
  },
  
  // Other configurations that work on all platforms
  reactStrictMode: true,
  swcMinify: true,
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
}

module.exports = nextConfig