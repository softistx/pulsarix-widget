import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const dist = join(import.meta.dir, "..", "dist");

// Runs after `bun run build` (verify orders them): the loader and the bundle agree.
test.skipIf(!existsSync(join(dist, "manifest.json")))(
  "the loader points at the hashed bundle in the manifest",
  async () => {
    const manifest = await Bun.file(join(dist, "manifest.json")).json();
    const loader = await Bun.file(join(dist, manifest.loader)).text();
    expect(manifest.widget).toMatch(/^widget\.[a-z0-9]+\.js$/);
    expect(loader).toContain(manifest.widget);
    expect(loader).not.toContain("__WIDGET_FILE__");
    expect(existsSync(join(dist, manifest.widget))).toBe(true);
    // Every lazy chunk the manifest lists is on disk, hashed.
    for (const chunk of manifest.chunks) {
      expect(chunk).toMatch(/^[\w-]+\.[a-z0-9]+\.js$/);
      expect(existsSync(join(dist, chunk))).toBe(true);
    }
  },
);

// The npm entry is one self-contained file: no relative import of a chunk.
test.skipIf(!existsSync(join(dist, "index.js")))(
  "the npm entry imports no chunk",
  async () => {
    const text = await Bun.file(join(dist, "index.js")).text();
    expect(text).not.toMatch(/(?:from|import\()\s*["']\.\//);
  },
);

// The host's root font size is the host's to choose: no rem unit may survive in a declaration
// of the built stylesheet. Not counted: class names (selectors such as `.h-\[calc\(2\.25rem`),
// the `var()` fallbacks of the utilities (embed.css defines every token, so they are never
// read) and Tailwind's unused `.container` rules.
const generatedCss = join(import.meta.dir, "..", "src/generated/widget-css.ts");
test.skipIf(!existsSync(generatedCss))(
  "the built stylesheet declares no rem length",
  async () => {
    const module = (await import(generatedCss)) as { default: string };
    const declarations = module.default
      .replace(/\.container\{[^}]*\}/g, "")
      .replace(/var\(--[a-z0-9-]+,[^)]*\)/g, "var()")
      .match(/\{[^{}]*\}/g);
    const withRem = (declarations ?? []).filter((d) => /[0-9.]rem\b/.test(d));
    expect(withRem).toEqual([]);
  },
);

// A shadow root ignores `@property`: the initial values must be plain declarations in the lowest
// layer, declared first so that every other rule overrides it.
test.skipIf(!existsSync(generatedCss))(
  "the built stylesheet starts with the property-initial layer and fills it",
  async () => {
    const { default: css } = (await import(generatedCss)) as {
      default: string;
    };
    expect(css.startsWith("@layer nxgt-property-initial;")).toBe(true);
    const layer = css.match(/@layer nxgt-property-initial\{[^{]*\{([^}]*)\}/);
    expect(layer?.[1]).toContain("--tw-ring-offset-width:");
  },
);

// A consumer's TypeScript must not need react, react-dom or react-hook-form (devDependencies
// here): no declaration reachable from the entry may import them.
test.skipIf(!existsSync(join(dist, "types/index.d.ts")))(
  "the declarations reachable from the entry import no bundled package",
  async () => {
    const seen = new Set<string>();
    const queue = [join(dist, "types/index.d.ts")];
    const bad: string[] = [];
    while (queue.length) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      const text = await Bun.file(file).text();
      for (const m of text.matchAll(/from\s+"([^"]+)"/g)) {
        const spec = m[1] as string;
        if (spec.startsWith(".")) {
          const base = join(file, "..", spec);
          queue.push(
            existsSync(`${base}.d.ts`)
              ? `${base}.d.ts`
              : join(base, "index.d.ts"),
          );
        } else if (
          /^(react|react-dom|react-hook-form|@softistx)(\/|$)/.test(spec)
        ) {
          bad.push(`${file}: ${spec}`);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(bad).toEqual([]);
  },
);

// The server helper is its own file: it imports only `node:crypto`, and neither the browser
// bundle nor the loader carries any of it.
test.skipIf(!existsSync(join(dist, "server.js")))(
  "the server helper stays out of the browser bundle and the loader",
  async () => {
    const server = await Bun.file(join(dist, "server.js")).text();
    expect(server).toContain("signPulsarixIdentity");
    const imports = [...server.matchAll(/from\s*["']([^"']+)["']/g)].map(
      (m) => m[1],
    );
    expect(imports).toEqual(["node:crypto"]);
    const manifest = await Bun.file(join(dist, "manifest.json")).json();
    for (const file of ["index.js", "loader.js", manifest.widget]) {
      const text = await Bun.file(join(dist, file)).text();
      expect(text).not.toContain("signPulsarixIdentity");
      expect(text).not.toContain("node:crypto");
    }
  },
);
