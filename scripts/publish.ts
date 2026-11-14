// Dual publish: npm.softistx.com (primary) then GitHub Packages (kept for 30 days).
// Each registry is skipped when the version is already there. Run from an up-to-date
// develop worktree after `bun run verify`:  bun run release   (add --dry-run to rehearse)
// Needs NPM_REGISTRY_PUBLISH_TOKEN (npm.softistx.com) and a GitHub token with write:packages
// (GITHUB_TOKEN, or `gh auth token`), each resolved when its registry's turn comes.
//
// Bun 1.4.4 ignores `--registry` while package.json has `publishConfig.registry`, so the
// manifest is pointed at each target for the call and restored afterwards.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const dryRun = process.argv.includes("--dry-run");
const manifestPath = "package.json";
const original = await Bun.file(manifestPath).text();
const pkg = JSON.parse(original);

const targets = [
  {
    registry: "https://npm.softistx.com",
    token: async () => process.env.NPM_REGISTRY_PUBLISH_TOKEN,
  },
  {
    registry: "https://npm.pkg.github.com",
    token: async () =>
      process.env.GITHUB_TOKEN ??
      (await $`gh auth token`.quiet().text()).trim(),
  },
];

async function isPublished(registry: string, token: string): Promise<boolean> {
  const res = await fetch(`${registry}/${pkg.name.replace("/", "%2f")}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return false;
  if (!res.ok)
    throw new Error(
      `${registry} answered ${res.status} (a 401 or 403 means the token lacks access)`,
    );
  const doc = (await res.json()) as { versions?: Record<string, unknown> };
  return doc.versions?.[pkg.version] !== undefined;
}

const dir = await mkdtemp(join(tmpdir(), "pulsarix-widget-publish-"));
try {
  for (const t of targets) {
    const token = await t.token();
    if (!token) throw new Error(`no token for ${t.registry}`);
    if (await isPublished(t.registry, token)) {
      console.log(
        `skip ${pkg.name}@${pkg.version} on ${t.registry}: already published`,
      );
      continue;
    }
    // The bunfig reads the token by reference from the environment, never from the file.
    const config = join(dir, "bunfig.toml");
    await Bun.write(
      config,
      `[install.scopes]\n"@softistx" = { url = "${t.registry}/", token = "$PUBLISH_AUTH" }\n`,
    );
    const manifest = {
      ...pkg,
      publishConfig: { ...pkg.publishConfig, registry: t.registry },
    };
    await Bun.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const flags = dryRun ? ["--dry-run"] : [];
    await $`bun publish --config=${config} --registry=${t.registry} ${flags}`.env(
      {
        ...process.env,
        PUBLISH_AUTH: token,
      },
    );
    console.log(
      `${dryRun ? "dry-run ok" : "published"} ${pkg.name}@${pkg.version} on ${t.registry}`,
    );
  }
} finally {
  await Bun.write(manifestPath, original);
  await rm(dir, { recursive: true, force: true });
}
