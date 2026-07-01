/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // bcryptjs is a pure-JS dependency used only on the server (auth).
  serverExternalPackages: ["bcryptjs"],
};

export default nextConfig;
