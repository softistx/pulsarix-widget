/**
 * Captures the launcher in the host fixture: the icon at 360 px (`auto`) and the pill at 1440 px
 * (`auto`), light and dark, and one 360 px capture with an `offset` clearing a sticky action bar.
 * Also checks that `auto` really switches when the viewport is resized.
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
  for (const [width, height, name] of [
    [360, 780, "icon"],
    [1440, 900, "pill"],
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
        const el = document.querySelector("pulsarix-widget");
        el?.setAttribute("theme", s);
        el?.removeAttribute("launcher");
      }, scheme);
      await page.waitForTimeout(300);
      const kind = () =>
        page
          .locator("pulsarix-widget")
          .evaluate(
            (el) =>
              el.shadowRoot
                ?.querySelector("[data-launcher]")
                ?.getAttribute("data-launcher") ?? null,
          );
      check((await kind()) === name, `auto is the ${name} at ${width} px`);
      if (name === "icon") {
        const box = await page
          .getByRole("button", { name: "Report a problem" })
          .boundingBox();
        check(
          Math.round(box?.width ?? 0) === 48 &&
            Math.round(box?.height ?? 0) === 48,
          `the icon is 48 px (${box?.width} x ${box?.height})`,
        );
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
      }
      await page.screenshot({
        path: `${out}/launcher-${name}-${width}-${scheme}.png`,
      });
      // Live switch: resize across 640 px.
      await page.setViewportSize({
        width: name === "icon" ? 900 : 400,
        height,
      });
      await page.waitForTimeout(300);
      check(
        (await kind()) === (name === "icon" ? "pill" : "icon"),
        `auto switches live when the viewport leaves ${width} px`,
      );
      if (name === "icon" && scheme === "light") {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(300);
        await page.evaluate(SETUP_BAR);
        await page.screenshot({
          path: `${out}/launcher-offset-before-${width}-${scheme}.png`,
        });
        await page.evaluate(() => {
          document
            .querySelector("pulsarix-widget")
            ?.setAttribute("offset-bottom", "88");
        });
        await page.waitForTimeout(300);
        const bar = await page.locator("#fake-bar button").boundingBox();
        const fab = await page
          .getByRole("button", { name: "Report a problem" })
          .boundingBox();
        check(
          !!bar && !!fab && fab.y + fab.height <= bar.y - 4,
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
