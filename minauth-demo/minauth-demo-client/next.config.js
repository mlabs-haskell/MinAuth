/** @type {import('next').NextConfig} */
module.exports = {
  // ... your other next.js configurations ...
  async headers() {
    return [
      {
        // Apply these headers to all routes in your application.
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }
        ]
      }
    ];
  },
  compiler: {
    styledComponents: true
  }
};
