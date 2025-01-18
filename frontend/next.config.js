 
 ** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Enable WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Optimize WASM for production
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
    };

    // Add fs fallback
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      stream: false,
    };

    return config;
  },
  // Environment variables that should be exposed to the browser
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
  // Allow importing from plotly.js
  transpilePackages: ['plotly.js-dist-min', 'react-plotly.js']
}

module.exports = nextConfig
