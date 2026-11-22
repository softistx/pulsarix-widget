/**
 * Captures the launcher in the host fixture: the round FAB at 360 and 1440 px, light and dark,
 * and one 360 px capture with an `offset` clearing a sticky action bar.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { serveFixture } from "./serve-fixture";

const out = process.argv[2] ?? "captures";
mkdirSync(out, { recursive: true });
const server = serveFixture(0);
const browser = await chromium.launch();
let failed = false;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed = true;
};

const SETUP_BAR = () => {
  const bar = document.createElement("div");
  bar.id = "fake-bar";
  bar.setAttribute(
    "style",
    "position:fixed;left:0;right:0;bottom:0;height:72px;display:flex;align-items:center;justify-content:flex-end;padding:0 16px;gap:8px;background:#fff!important;border-top:1px solid #ccc!important;z-index:10",
  );
  bar.innerHTML =
    '<button type="button" style="padding:10px 20px!important;font:600 16px sans-serif!important;color:#fff!important;background:#2f5fd0!important;border:0!important;border-radius:20px!important">Save order</button>';
  document.body.append(bar);
};

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
      await page.evaluate((s) => {
        document.querySelector("pulsarix-widget")?.setAttribute("theme", s);
      }, scheme);
      await page.waitForTimeout(300);
      const kind = await page
        .locator("pulsarix-widget")
        .evaluate(
          (el) =>
            el.shadowRoot
              ?.querySelector("[data-launcher]")
              ?.getAttribute("data-launcher") ?? null,
        );
      check(kind === "fab", `the launcher is the round FAB at ${width} px`);
      const fab = page.getByRole("button", { name: "Report a problem" });
      const box = await fab.boundingBox();
      check(
        !!box && Math.abs(box.width - box.height) < 1 && box.width >= 48,
        `the FAB is round and at least 48 px (${box?.width} x ${box?.height})`,
      );
      await page.screenshot({
        path: `${out}/launcher-${width}-${scheme}.png`,
      });
      if (width === 360 && scheme === "light") {
        await page.evaluate(SETUP_BAR);
        await page.evaluate(() => {
          document
            .querySelector("pulsarix-widget")
            ?.setAttribute("offset-bottom", "88");
        });
        await page.waitForTimeout(300);
        const bar = await page.locator("#fake-bar button").boundingBox();
        const lifted = await fab.boundingBox();
        check(
          !!bar && !!lifted && lifted.y + lifted.height <= bar.y - 4,
          "the offset lifts the launcher above the sticky bar's button",
        );
        await page.screenshot({
          path: `${out}/launcher-offset-${width}-${scheme}.png`,
        });
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.stop(true);
}
process.exit(failed ? 1 : 0);
