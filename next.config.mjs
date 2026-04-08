/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow the build to complete even when AUTH_SECRET / Azure env vars
  // aren't set in the local dev machine. On Vercel, set them in:
  //   Project Settings → Environment Variables
  //   AUTH_SECRET, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID
  env: {},
};

export default nextConfig;
