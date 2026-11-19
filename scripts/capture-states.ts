/**
 * Captures the loading states of "My requests" and of a request thread: the requests API is
 * held for a few seconds so the skeleton stays on screen. 360 and 1440 px, light and dark.
 * Usage: bun scripts/capture-states.ts <out-dir>
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { serveFixture } from "./serve-fixture";

const out = process.argv[2] ?? "captures-states";
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
      await page.route("**/public/graphql", async (route) => {
        await new Promise((done) => setTimeout(done, 6_000));
        await route.continue();
      });
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
      await page.getByRole("button", { name: /Report a problem/ }).click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("tab", { name: /My requests/ }).click();
      await page.getByText("Loading your requests...").waitFor({
        state: "attached",
      });
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${out}/loading-${width}-${scheme}.png`,
      });
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.stop(true);
}
console.log(`captures in ${out}`);
