/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Old shareable links (/?candidate=slug) now go to the candidate's page.
      {
        source: "/",
        has: [{ type: "query", key: "candidate", value: "(?<slug>[a-z0-9-]+)" }],
        destination: "/candidates/:slug",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return {
      // The home page is the 3D globe from the User-Interface branch: a static
      // app in public/ (index.html, styles.css, js/, data/). Serve it at "/".
      beforeFiles: [{ source: "/", destination: "/index.html" }],
    };
  },
};

export default nextConfig;
