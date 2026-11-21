/**
 * Copies the public schema and the persisted operations the API prints into `schema/`.
 * `bun scripts/schema-sync.ts` writes them; `--check` fails when the committed copies differ and
 * skips (exit 0) when no API checkout is there, so `verify` runs anywhere.
 *
 * Source: the checkout `PULSARIX_API` (default `../pulsarix-api`, relative to this repository's main checkout), read through git at
 * `PULSARIX_API_REF` (default `origin/feat/align-conventions`; `origin/develop` once the API's
 * alignment has landed), so the API's working tree and branch do not matter.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = join(import.meta.dir, "..");
// A worktree sits elsewhere: the default is the sibling of the repository's main checkout.
const common = Bun.spawnSync([
  "git",
  "-C",
  root,
  "rev-parse",
  "--git-common-dir",
]);
const mainCheckout = resolve(
  root,
  new TextDecoder().decode(common.stdout).trim(),
  "..",
);
const api = resolve(
  mainCheckout,
  process.env.PULSARIX_API ?? "../pulsarix-api",
);
const ref = process.env.PULSARIX_API_REF ?? "origin/feat/align-conventions";
const check = process.argv.includes("--check");
const target = join(root, "schema");

async function git(...args: string[]): Promise<string | null> {
  const run = Bun.spawn(["git", "-C", api, ...args], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const out = await new Response(run.stdout).text();
  return (await run.exited) === 0 ? out : null;
}

if (!existsSync(join(api, ".git"))) {
  const message = `pulsarix-api checkout not found at ${api} (set PULSARIX_API)`;
  if (check) {
    console.log(`schema:check skipped: ${message}`);
    process.exit(0);
  }
  console.error(message);
  process.exit(1);
}

const listing = await git("ls-tree", "--name-only", ref, "operations/public/");
const schema = await git("show", `${ref}:schema.public.graphql`);
if (listing === null || schema === null) {
  const message = `${ref} has no schema.public.graphql or operations/public in ${api}`;
  if (check) {
    console.log(`schema:check skipped: ${message}`);
    process.exit(0);
  }
  console.error(message);
  process.exit(1);
}

const source = new Map<string, string>([["schema.public.graphql", schema]]);
for (const path of listing.split("\n").filter((p) => p.endsWith(".graphql"))) {
  const text = await git("show", `${ref}:${path}`);
  if (text === null) throw new Error(`cannot read ${path} at ${ref}`);
  source.set(`operations/${path.split("/").pop()}`, text);
}

const local = new Map<string, string>();
const read = async (dir: string, prefix: string) => {
  if (!existsSync(dir)) return;
  for (const name of await readdir(dir)) {
    if (name.endsWith(".graphql"))
      local.set(prefix + name, await Bun.file(join(dir, name)).text());
  }
};
await read(target, "");
await read(join(target, "operations"), "operations/");

if (check) {
  const stale = [...new Set([...source.keys(), ...local.keys()])]
    .filter((name) => source.get(name) !== local.get(name))
    .sort();
  if (stale.length > 0) {
    console.error(
      `schema:check: ${stale.length} file(s) differ from ${ref} of ${api}:\n  ${stale.join("\n  ")}\nRun \`bun run schema:sync\` and commit.`,
    );
    process.exit(1);
  }
  console.log(`schema:check ok: ${source.size} files match ${ref}`);
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
await mkdir(join(target, "operations"), { recursive: true });
for (const [name, text] of source) await Bun.write(join(target, name), text);
console.log(`schema:sync: ${source.size} files copied from ${ref} of ${api}`);
