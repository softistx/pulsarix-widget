/**
 * Captures the widget over a host page that wears its own `@softistx/material` theme (a teal
 * primary, not the widget's lavande), light and dark, at 360 and 1440 px: the closed launcher and
 * the open form. Also checks that the widget took the host's primary, followed the host's switch to
 * dark, and that `inheritTheme: false` keeps lavande. Usage: bun scripts/capture-theme.ts <dir>
 */
import { mkdirSync } from "node:fs";
import { defineTheme, themeToCss } from "@softistx/material-core/theme";
import { chromium } from "playwright-core";
import { serveFixture } from "./serve-fixture";

const out = process.argv[2] ?? "captures";
mkdirSync(out, { recursive: true });
const hostTheme = defineTheme({
  name: "host",
  label: "Host",
  colors: { primary: "#0b7a75" },
});
const hostCss = themeToCss(hostTheme, { header: false }).css;
const server = serveFixture(0);
const browser = await chromium.launch();
let failed = false;
const check = (ok: boolean, what: string) => {
  if (!ok) {
    failed = true;
    console.error(`FAIL: ${what}`);
  }
};
const primaryOf = (page: import("playwright-core").Page) =>
  page.evaluate(() => {
    const root = document
      .querySelector("pulsarix-widget")
      ?.shadowRoot?.querySelector<HTMLElement>(".pulsarix-root");
    return root ? getComputedStyle(root).getPropertyValue("--primary") : "";
  });
try {
  for (const [width, height] of [
    [360, 780],
    [1440, 900],
  ] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const page = await (
        await browser.newContext({ viewport: { width, height } })
      ).newPage();
      await page.goto(`http://localhost:${server.port}/`);
      await page.waitForFunction(() =>
        document
          .querySelector("pulsarix-widget")
          ?.shadowRoot?.querySelector("button"),
      );
      // The host: its theme's tokens on <html>, its scheme by class, like a material app.
      await page.addStyleTag({
        content: `${hostCss}\nhtml{color-scheme:light}html.dark{color-scheme:dark}`,
      });
      await page.evaluate((s) => {
        document.documentElement.setAttribute("data-nxgt-theme", "host");
        document.documentElement.classList.toggle("dark", s === "dark");
      }, scheme);
      await page.waitForTimeout(300);
      const hostPrimary = await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--primary")
          .trim(),
      );
      check(
        (await primaryOf(page)).trim() === hostPrimary && hostPrimary !== "",
        `${scheme} ${width}: widget primary is the host's (${hostPrimary})`,
      );
      const shot = (name: string) =>
        page.screenshot({
          path: `${out}/theme-${name}-${width}-${scheme}.png`,
        });
      await shot("closed");
      await page.getByRole("button", { name: "Report a problem" }).click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(500);
      await shot("form");
      if (width === 1440 && scheme === "light") {
        // The host switches to dark: the open widget follows without a reload.
        await page.evaluate(() =>
          document.documentElement.classList.add("dark"),
        );
        await page.waitForTimeout(400);
        const darkPrimary = await page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--primary")
            .trim(),
        );
        check(
          (await primaryOf(page)).trim() === darkPrimary &&
            darkPrimary !== hostPrimary,
          "the widget follows the host's switch to dark",
        );
        await shot("form-after-switch-dark");
        // Opt-out: the widget's own look again.
        await page.evaluate(() =>
          document
            .querySelector("pulsarix-widget")
            ?.setAttribute("inherit-theme", "false"),
        );
        await page.waitForTimeout(400);
        check(
          (await primaryOf(page)).trim() !== darkPrimary,
          "inherit-theme=false restores the widget's own primary",
        );
        await shot("form-opt-out");
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.stop(true);
}
if (failed) process.exit(1);
console.log(`captures in ${out}`);
