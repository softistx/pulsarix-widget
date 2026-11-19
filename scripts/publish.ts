// Publishes @softistx/pulsarix-widget to npmjs (public). Run by .github/workflows/publish.yml
// after `bun run verify`; there is no local npm publish. Idempotent: a version already on
// npmjs is skipped, so a rerun does nothing.  bun run release   (add --dry-run to rehearse)
// Needs NPM_TOKEN (the softistx org secret), read only from the environment.
//
// Bun 1.4.4 ignores `--registry` while package.json has `publishConfig.registry`, so the
// manifest is the one that names npmjs (it does), and the token goes through a throwaway
// bunfig in a private temp directory, never `~/.npmrc` or the repository.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const REGISTRY = "https://registry.npmjs.org";
const dryRun = process.argv.includes("--dry-run");
const pkg = (await Bun.file("package.json").json()) as {
  name: string;
  version: string;
};

async function isPublished(): Promise<boolean> {
  const res = await fetch(
    `${REGISTRY}/${pkg.name.replace("/", "%2f")}/${pkg.version}`,
  );
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`${REGISTRY} answered ${res.status}`);
  return true;
}

if (await isPublished()) {
  console.log(
    `skip ${pkg.name}@${pkg.version} on ${REGISTRY}: already published`,
  );
  process.exit(0);
}

const token = process.env.NPM_TOKEN;
if (!token && !dryRun) throw new Error("NPM_TOKEN is not set");

const dir = await mkdtemp(join(tmpdir(), "pulsarix-widget-publish-"));
try {
  const config = join(dir, "bunfig.toml");
  // The bunfig reads the token by reference from the environment, never from the file.
  await Bun.write(
    config,
    `[install.scopes]\n"@softistx" = { url = "${REGISTRY}/", token = "$PUBLISH_AUTH" }\n`,
  );
  const flags = dryRun ? ["--dry-run"] : [];
  await $`bun publish --config=${config} --registry=${REGISTRY} --access=public ${flags}`.env(
    { ...process.env, PUBLISH_AUTH: token ?? "dry-run" },
  );
  console.log(
    `${dryRun ? "dry-run ok" : "published"} ${pkg.name}@${pkg.version} on ${REGISTRY}`,
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
