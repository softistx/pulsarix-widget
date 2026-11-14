// Dual publish: npm.softistx.com (primary) then GitHub Packages (kept for 30 days).
// Each registry is skipped when the version is already there. Run from an up-to-date
// develop worktree after `bun run verify`:  bun scripts/publish.ts
// Needs NPM_REGISTRY_PUBLISH_TOKEN (npm.softistx.com) and a GitHub token with write:packages
// (GITHUB_TOKEN, or `gh auth token`).
import { $ } from "bun";

const pkg = await Bun.file("package.json").json();
const spec = `${pkg.name}@${pkg.version}`;

const gh = process.env.GITHUB_TOKEN ?? (await $`gh auth token`.text()).trim();
const registries = [
  {
    url: "https://npm.softistx.com",
    token: process.env.NPM_REGISTRY_PUBLISH_TOKEN,
    host: "npm.softistx.com",
  },
  { url: "https://npm.pkg.github.com", token: gh, host: "npm.pkg.github.com" },
];

for (const r of registries) {
  if (!r.token) throw new Error(`no token for ${r.url}`);
  const rc = `@softistx:registry=${r.url}\n//${r.host}/:_authToken=\${PUBLISH_AUTH}\n`;
  const rcPath = `${process.env.TMPDIR ?? "/tmp"}/pulsarix-widget-publish.npmrc`;
  await Bun.write(rcPath, rc);
  const env = {
    ...process.env,
    PUBLISH_AUTH: r.token,
    NPM_CONFIG_USERCONFIG: rcPath,
  };
  const view = await $`npm view ${spec} version --registry ${r.url}`
    .env(env)
    .quiet()
    .nothrow();
  if (view.exitCode === 0 && view.stdout.toString().trim() === pkg.version) {
    console.log(`skip ${spec} on ${r.url}: already published`);
    continue;
  }
  await $`npm publish --registry ${r.url} --access restricted`.env(env);
  console.log(`published ${spec} on ${r.url}`);
}
