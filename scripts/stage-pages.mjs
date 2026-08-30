import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { pagesRepoName, pagesSmokeRoot } from "./pages-base.mjs";

if (!existsSync("dist/index.html")) {
  console.error("Missing dist/index.html. Run GITHUB_PAGES=true npm run build first.");
  process.exit(1);
}

const repo = pagesRepoName();
const root = pagesSmokeRoot();
const dest = join(root, repo);
rmSync(root, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync("dist", dest, { recursive: true });
