import { execFileSync } from "node:child_process";

const DEFAULT_PAGES_REPO = "build-arena";
const SMOKE_ROOT = "/tmp/build-arena-pages-smoke";
const SMOKE_ORIGIN = "http://127.0.0.1:4173";

function repoNameFromRemote(url) {
  const trimmed = url.trim();
  const path = trimmed.split(/[/:]/).pop() ?? "";
  const name = path.replace(/\.git$/i, "");
  return name || null;
}

export function pagesRepoName() {
  const fromCi = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (fromCi) return fromCi;
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return repoNameFromRemote(url) ?? DEFAULT_PAGES_REPO;
  } catch {
    return DEFAULT_PAGES_REPO;
  }
}

export function pagesSmokeRoot() {
  return SMOKE_ROOT;
}

export function pagesSmokeBaseUrl() {
  return `${SMOKE_ORIGIN}/${pagesRepoName()}/`;
}
