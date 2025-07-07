// File: /next.config.js
// Next.js configuration for qfology - Enhanced Competitive Intelligence System
// Supports deployment to GitHub Pages, Vercel, and Netlify with environment-based configuration

/** @type {import('next').NextConfig} */

// Check if we're building for GitHub Pages
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig = {
  // Only use static export for GitHub Pages
  ...(isGitHubPages && {
    output: 'export',
    basePath: '/qfology',
    assetPrefix: '/qfology/',
    trailingSlash: true,
  }),
  
  // Image configuration based on environment
  images: {
    unoptimized: isGitHubPages, // Only disable optimization for GitHub Pages
  },
  
  // Other configurations that work on all platforms
  reactStrictMode: true,
  swcMinify: true,
  
  // Ensure API routes work on Vercel/Netlify (disabled for GitHub Pages)
  ...((!isGitHubPages) && {
    // This ensures API routes work properly on dynamic platforms
    experimental: {
      serverComponentsExternalPackages: ['jsdom']
    }
  }),
}

module.exports = nextConfig