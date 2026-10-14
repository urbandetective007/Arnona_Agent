import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// App version shown in the sidebar: "1.<n>", where n counts the commits that
// changed the app itself (src/). The agent's report commits elsewhere in the
// repo don't bump it. Needs full git history at build time (deploy.yml
// checks out with fetch-depth: 0); falls back to "dev" without git.
function appVersion(): string {
  try {
    const n = execSync("git rev-list --count HEAD -- src", { encoding: "utf8" }).trim();
    return `1.${n}`;
  } catch {
    return "dev";
  }
}

const buildDate = new Date().toLocaleDateString("he-IL", {
  timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", year: "2-digit",
});

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/Arnona_Agent',
  images: { unoptimized: true },
  env: {
    APP_VERSION: appVersion(),
    APP_BUILD_DATE: buildDate,
  },
};

export default nextConfig;
