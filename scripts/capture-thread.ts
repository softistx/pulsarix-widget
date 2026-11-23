/**
 * Captures the request thread in the host fixture: 360 and 1440 px, light and dark.
 *   thread    a request with replies from the team (one with a file)
 *   composer  the composer holding an attached file
 *   declined  a Declined request: read-only, its reason shown
 *   resolved  a resolved request with Reopen
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
      await page.getByRole("menuitem", { name: /My requests/ }).click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("radio", { name: /^All/ }).click();

      const open = async (title: string) => {
        await page
          .getByRole("button", { name: `Open request: ${title}` })
          .click();
        await page.getByRole("log").waitFor();
        await page.waitForTimeout(500);
      };
      const back = async () => {
        await page.getByRole("button", { name: "Back" }).click();
        await page.getByRole("radio", { name: /^All/ }).waitFor();
      };

      await open("How do I change the billing e-mail of my account?");
      await shoot("thread");
      await page
        .getByPlaceholder("Write a reply...")
        .fill("Thanks, that fixed it");
      await page
        .locator('pulsarix-widget input[type="file"]')
        .first()
        .setInputFiles({
          name: "screenshot.png",
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            "base64",
          ),
        });
      await page.getByText("screenshot.png").first().waitFor();
      await page.waitForTimeout(600);
      await shoot("composer");
      await back();

      await open("Add a dark mode to the store");
      await shoot("declined");
      await back();

      await open("The product images load slowly on a phone");
      await shoot("resolved");
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.stop(true);
}
