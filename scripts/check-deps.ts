/**
 * `bun scripts/check-deps.ts` fails when an import breaks the layout's one-way rule (see
 * AGENTS.md "Layout"):
 *   - `src/core/**` imports only `core` (and the root `config.ts`, the public config types);
 *   - `src/modules/<m>/**` imports its own module, `core` and `config.ts`, plus the leaf modules
 *     listed in `MAY_USE` (`files`, `screenshot`: shared building blocks that import no module);
 *   - `src/config.ts` imports nothing of `src`;
 *   - the root files (`index`, `loader`, `element`, `app`, ...) are the composition: free.
 * Test files (`*.test.ts[x]`) are integration checks and are not held to it.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = join(import.meta.dir, "..");
const src = join(root, "src");

/** Modules a module may import beside itself: the leaves, which import no other module. */
const MAY_USE: Record<string, string[]> = {
  report: ["files", "screenshot"],
  requests: ["files"],
  files: [],
  screenshot: [],
};

type Place =
  | { kind: "root"; file: string }
  | { kind: "core" }
  | { kind: "module"; name: string }
  | { kind: "generated" };

function placeOf(file: string): Place {
  const parts = relative(src, file).split("/");
  if (parts[0] === "core") return { kind: "core" };
  if (parts[0] === "modules" && parts[1])
    return { kind: "module", name: parts[1] };
  if (parts[0] === "generated") return { kind: "generated" };
  return { kind: "root", file: parts.join("/") };
}

export function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
  }
}

const SPECIFIER = /(?:from|import\(?)\s*["'](\.\.?\/[^"']*)["']/g;

/** Why `from` may not import `to`, or null when it may. */
export function violation(from: string, to: string): string | null {
  const a = placeOf(from);
  const b = placeOf(to);
  if (b.kind === "generated") return null;
  const isConfig = b.kind === "root" && b.file === "config.ts";
  if (a.kind === "root")
    return a.file === "config.ts" ? "config.ts imports nothing of src" : null;
  if (isConfig) return null;
  if (a.kind === "core")
    return b.kind === "core"
      ? null
      : "core never imports a module or a root file";
  if (a.kind === "module") {
    if (b.kind === "core") return null;
    if (b.kind === "module") {
      if (b.name === a.name) return null;
      return MAY_USE[a.name]?.includes(b.name)
        ? null
        : `module ${a.name} may not import module ${b.name}`;
    }
    return "a module never imports a root file";
  }
  return null;
}

function scan(): void {
  const problems: string[] = [];
  for (const file of sources(src)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(SPECIFIER)) {
      const base = resolve(dirname(file), match[1] as string);
      const target = [".ts", ".tsx", "/index.ts", "/index.tsx", ""]
        .map((ext) => base + ext)
        .find((path) => {
          try {
            return statSync(path).isFile();
          } catch {
            return false;
          }
        });
      if (!target) continue; // a stylesheet, or a file the build generates
      const why = violation(file, target);
      if (why)
        problems.push(
          `${relative(root, file)}: imports ${relative(root, target)} (${why})`,
        );
    }
  }

  if (problems.length > 0) {
    console.error(problems.join("\n"));
    console.error(`check:deps: ${problems.length} import(s) break the layout`);
    process.exit(1);
  }
  console.log("check:deps: imports follow the layout");
}

if (import.meta.main) scan();
