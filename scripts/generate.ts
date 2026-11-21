/**
 * Type-only codegen: the operations' variable and result types and the `PersistedId` union, from
 * `schema/`. No client preset and no runtime: the output is types and adds no byte to the bundle.
 * `bun scripts/generate.ts` writes `src/core/api/public.ts`; `--check` fails when it is stale.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { generate } from "@graphql-codegen/cli";

const root = join(import.meta.dir, "..");
const out = join(root, "src", "core", "api", "public.ts");

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

const dir = join(root, "schema", "operations");
const ids = (await readdir(dir))
  .filter((name) => name.endsWith(".graphql"))
  .map((name) => name.replace(/\.graphql$/, ""))
  .sort();

/** The generated type names of an operation: `myRequests` -> `MyRequestsQuery`. */
async function typesOf(id: string): Promise<{ result: string; vars: string }> {
  const source = await Bun.file(join(dir, `${id}.graphql`)).text();
  const head = source.match(/^(query|mutation)\s+(\w+)/m);
  if (!head || head[2] !== id)
    throw new Error(`${id}.graphql must declare the operation \`${id}\``);
  // `publicCall` reads `data[id]`: the root field must carry the operation's name.
  if (!source.match(new RegExp(`\\{\\s*${id}\\b`)))
    throw new Error(`${id}.graphql: the root field must be \`${id}\``);
  const base = `${id[0]?.toUpperCase()}${id.slice(1)}${head[1] === "query" ? "Query" : "Mutation"}`;
  return { result: `${base}["${id}"]`, vars: `${base}Variables` };
}
const entries = await Promise.all(
  ids.map(async (id) => ({ id, ...(await typesOf(id)) })),
);
const text = `${file?.content.trimEnd()}

/** The persisted operations the API serves on \`/public/graphql\`, by id. */
export type PersistedId =
${ids.map((id) => `  | "${id}"`).join("\n")};

/** Each persisted operation's variables and the data \`publicCall\` answers, by id (types only). */
export interface PersistedOperations {
${entries.map((e) => `  ${e.id}: { variables: ${e.vars}; result: ${e.result} };`).join("\n")}
}
`;

if (process.argv.includes("--check")) {
  const current = (await Bun.file(out).exists())
    ? await Bun.file(out).text()
    : null;
  if (current !== text) {
    console.error(
      "generate:check: src/core/api/public.ts is stale. Run `bun run generate` and commit.",
    );
    process.exit(1);
  }
  console.log("generate:check ok");
} else {
  await Bun.write(out, text);
  console.log(`generate: ${ids.length} operations, wrote ${out}`);
}
