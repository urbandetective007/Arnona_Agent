import type { NextConfig } from "next";
import cityConfig from "./city.config.json";

const nextConfig: NextConfig = {
  output: 'export',
  // The URL path the site is served under (GitHub Pages: "/<repo name>").
  basePath: cityConfig.deploy.basePath,
  images: { unoptimized: true },
};

export default nextConfig;
