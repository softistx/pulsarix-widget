/**
 * Type-only codegen: the operations' variable and result types and the `PersistedId` union, from
 * `schema/`. No client preset and no runtime: the output is types and adds no byte to the bundle.
 * `bun scripts/generate.ts` writes `src/graphql/public.ts`; `--check` fails when it is stale.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { generate } from "@graphql-codegen/cli";

const root = join(import.meta.dir, "..");
const out = join(root, "src", "graphql", "public.ts");

const [file] = ((await generate(
  {
    schema: join(root, "schema", "schema.public.graphql"),
    documents: [join(root, "schema", "operations", "*.graphql")],
    silent: true,
    generates: {
      [out]: {
        plugins: ["typescript-operations"],
        config: {
          enumsAsTypes: true,
          useTypeImports: true,
          skipTypename: true,
          avoidOptionals: { field: true, inputValue: false, object: false },
          // The wire is JSON: ids and dates are strings.
          defaultScalarType: "string",
        },
      },
    },
  },
  false,
)) ?? []) as { content: string }[];

const ids = (await readdir(join(root, "schema", "operations")))
  .filter((name) => name.endsWith(".graphql"))
  .map((name) => name.replace(/\.graphql$/, ""))
  .sort();
const text = `${file?.content.trimEnd()}

/** The persisted operations the API serves on \`/public/graphql\`, by id. */
export type PersistedId =
${ids.map((id) => `  | "${id}"`).join("\n")};
`;

if (process.argv.includes("--check")) {
  const current = (await Bun.file(out).exists())
    ? await Bun.file(out).text()
    : null;
  if (current !== text) {
    console.error(
      "generate:check: src/graphql/public.ts is stale. Run `bun run generate` and commit.",
    );
    process.exit(1);
  }
  console.log("generate:check ok");
} else {
  await Bun.write(out, text);
  console.log(`generate: ${ids.length} operations, wrote ${out}`);
}
