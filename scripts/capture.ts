/** Captures the open widget in the host fixture: 360 and 1440 px, light and dark. */
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
      await page.goto(`http://localhost:${server.port}/`);
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
      await page.screenshot({ path: `${out}/closed-${width}-${scheme}.png` });
      await page.evaluate(() => window.PulsarixWidget.open());
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${out}/open-${width}-${scheme}.png` });
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.stop(true);
}
console.log(`captures in ${out}`);
