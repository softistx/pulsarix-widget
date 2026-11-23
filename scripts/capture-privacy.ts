/**
 * Captures the privacy controls of My requests: 360 and 1440 px, light and dark.
 *   privacy  The preferences view with the e-mail switch and "Delete my data" (scrolled to the foot)
 *   confirm  the "Delete my data?" confirmation open
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { serveFixture } from "./serve-fixture";

const out = process.argv[2] ?? "captures";
mkdirSync(out, { recursive: true });
const server = serveFixture(0);
const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [360, 780],
    [1440, 900],
  ] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const page = await (
        await browser.newContext({
          viewport: { width, height },
          colorScheme: scheme,
        })
      ).newPage();
      await page.goto(`http://localhost:${server.port}/identified`);
      await page.waitForFunction(() =>
        document
          .querySelector("pulsarix-widget")
          ?.shadowRoot?.querySelector("button"),
      );
      await page.evaluate(
        (s) =>
          document.querySelector("pulsarix-widget")?.setAttribute("theme", s),
        scheme,
      );
      const shoot = (name: string) =>
        page.screenshot({ path: `${out}/${name}-${width}-${scheme}.png` });
      await page.getByRole("button", { name: /Report a problem/ }).click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("menuitem", { name: /My requests/ }).click();
      await page
        .getByRole("button", { name: /Open request: /i })
        .first()
        .waitFor();
      await page.waitForTimeout(300);
      await shoot("list");
      await page.getByRole("button", { name: "Preferences" }).click();
      const toggle = page.getByRole("switch", {
        name: /E-mails about my requests/,
      });
      await toggle.waitFor();
      await toggle.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await shoot("privacy");
      await page.getByRole("button", { name: "Delete my data" }).click();
      await page.getByRole("alertdialog").waitFor();
      await page.waitForTimeout(500);
      await shoot("confirm");
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.stop(true);
}
