/**
 * Captures the form with an attached file in fr and en: 360 and 1440 px, light and dark.
 * Usage: bun scripts/capture-i18n.ts <out-dir>
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { chooseFiles, filesInput, png } from "./files-test";
import { serveFixture } from "./serve-fixture";

const out = process.argv[2] ?? "captures-i18n";
mkdirSync(out, { recursive: true });
const server = serveFixture(0);
const browser = await chromium.launch();
let failed = false;
try {
  for (const [width, height] of [
    [360, 780],
    [1440, 900],
  ] as const) {
    for (const scheme of ["light", "dark"] as const) {
      for (const [locale, launcher, remove] of [
        ["en", "Report a problem", /^Remove/],
        ["fr", "Signaler un problème", /^Retirer|^Supprimer/],
      ] as const) {
        try {
          const context = await browser.newContext({
            viewport: { width, height },
            colorScheme: scheme,
          });
          const page = await context.newPage();
          await page.goto(`http://localhost:${server.port}/`);
          await page.waitForFunction(() =>
            document
              .querySelector("pulsarix-widget")
              ?.shadowRoot?.querySelector("button"),
          );
          await page.evaluate(
            ([s, l]) => {
              const el = document.querySelector("pulsarix-widget");
              el?.setAttribute("theme", s as string);
              el?.setAttribute("locale", l as string);
            },
            [scheme, locale],
          );
          await page.getByRole("button", { name: launcher }).click();
          await page.getByRole("dialog").waitFor();
          await page.waitForTimeout(400);
          await chooseFiles(
            page,
            [png("checkout-error.png", 48_000)],
            locale === "fr" ? "Annuler" : "Cancel",
          );
          await page.getByRole("button", { name: remove }).first().waitFor();
          await page
            .locator("pulsarix-widget [data-testid=attachments]")
            .evaluate((el) => el.scrollIntoView({ block: "center" }));
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `${out}/attached-${locale}-${width}-${scheme}.png`,
          });
          await context.close();
        } catch (error) {
          failed = true;
          console.error(`${locale} ${width} ${scheme}: ${error}`);
        }
      }
    }
  }
} finally {
  await browser.close();
  server.stop(true);
}
if (failed) process.exit(1);
console.log(`captures in ${out}`);
