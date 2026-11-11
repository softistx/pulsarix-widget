import { expect, test } from "bun:test";
import { propertyDefaults } from "../scripts/property-defaults";

test("initial values are copied into the properties layer", () => {
  const css =
    '@property --a{syntax:"*";inherits:false;initial-value:0s}@property --b{syntax:"*";inherits:false}.x{top:0}';
  expect(propertyDefaults(css)).toBe(
    `${css}@layer properties{:host,*,:before,:after,::backdrop{--a:0s}}`,
  );
});

test("a stylesheet without @property is unchanged", () => {
  expect(propertyDefaults(".x{top:0}")).toBe(".x{top:0}");
});
