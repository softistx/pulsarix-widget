// Dual publish: npm.softistx.com (primary) then GitHub Packages (kept for 30 days).
// Each registry is skipped when the version is already there. Run from an up-to-date
// develop worktree after `bun run verify`:  bun run release
// Needs NPM_REGISTRY_PUBLISH_TOKEN (npm.softistx.com) and a GitHub token with write:packages
// (GITHUB_TOKEN, or `gh auth token`), each resolved when its registry's turn comes.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const pkg = await Bun.file("package.json").json();
const spec = `${pkg.name}@${pkg.version}`;

const registries = [
  {
    url: "https://npm.softistx.com",
    host: "npm.softistx.com",
    token: async () => process.env.NPM_REGISTRY_PUBLISH_TOKEN,
  },
  {
    url: "https://npm.pkg.github.com",
    host: "npm.pkg.github.com",
    token: async () =>
      process.env.GITHUB_TOKEN ??
      (await $`gh auth token`.quiet().text()).trim(),
  },
];

const dir = await mkdtemp(join(tmpdir(), "pulsarix-widget-publish-"));
try {
  for (const r of registries) {
    const token = await r.token();
    if (!token) throw new Error(`no token for ${r.url}`);
    // The npmrc holds only a placeholder; the token goes in through the environment.
    const rcPath = join(dir, `${r.host}.npmrc`);
    await Bun.write(
      rcPath,
      `@softistx:registry=${r.url}\n//${r.host}/:_authToken=\${PUBLISH_AUTH}\n`,
    );
    const env = {
      ...process.env,
      PUBLISH_AUTH: token,
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
} finally {
  await rm(dir, { recursive: true, force: true });
}
