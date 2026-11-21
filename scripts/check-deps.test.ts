import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { sources, violation } from "./check-deps";

const src = join(import.meta.dir, "..", "src");
const at = (path: string) => join(src, path);

describe("check-deps violation()", () => {
  test("core never imports a module", () => {
    expect(
      violation(at("core/api/api.ts"), at("modules/report/api.ts")),
    ).not.toBeNull();
  });

  test("report and requests never import each other", () => {
    expect(
      violation(at("modules/report/api.ts"), at("modules/requests/api.ts")),
    ).not.toBeNull();
    expect(
      violation(at("modules/requests/api.ts"), at("modules/report/api.ts")),
    ).not.toBeNull();
  });

  test("a leaf module imports no feature module", () => {
    expect(
      violation(at("modules/files/api.ts"), at("modules/report/api.ts")),
    ).not.toBeNull();
  });

  test("report may use the files leaf", () => {
    expect(
      violation(at("modules/report/api.ts"), at("modules/files/api.ts")),
    ).toBeNull();
  });

  test("anything may import config.ts, which imports nothing of src", () => {
    expect(violation(at("core/api/api.ts"), at("config.ts"))).toBeNull();
    expect(violation(at("modules/report/api.ts"), at("config.ts"))).toBeNull();
    expect(violation(at("config.ts"), at("core/api/api.ts"))).not.toBeNull();
  });

  test("a module never imports a root file other than config.ts", () => {
    expect(
      violation(at("modules/report/api.ts"), at("app.tsx")),
    ).not.toBeNull();
  });
});

describe("check-deps sources()", () => {
  test("test files are exempt", () => {
    const files = [...sources(src)];
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((file) => /\.test\.tsx?$/.test(file))).toBe(false);
  });
});
