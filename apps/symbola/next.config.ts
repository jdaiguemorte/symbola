import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // @node-rs/argon2 et postgres.js embarquent du binaire natif : Next ne
  // doit pas tenter de les passer dans le bundler webpack (SOC-04).
  serverExternalPackages: ["@node-rs/argon2", "@node-rs/argon2-darwin-arm64", "postgres"],
};

export default nextConfig;
