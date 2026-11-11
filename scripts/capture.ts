/**
 * Captures the widget in the host fixture: 360 and 1440 px, light and dark.
 * Per combination: closed, the open form, its validation errors, the confirmation.
 * Also checks that focus returns to the launcher when the dialog closes.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { serveFixture } from "./serve-fixture";

const out = process.argv[2] ?? "captures";
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
      const shot = (name: string) =>
        page.screenshot({ path: `${out}/${name}-${width}-${scheme}.png` });
      const widget = page.locator("pulsarix-widget");
      await shot("closed");
      await page.getByRole("button", { name: "Report a problem" }).click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(500);
      await shot("form");
      await page.getByRole("button", { name: "Send report" }).click();
      await page.getByText("Enter a title.").waitFor();
      await page.waitForTimeout(300);
      await shot("errors");
      await page.getByRole("textbox", { name: /Title/ }).fill("Checkout busy");
      await page
        .getByRole("textbox", { name: /What happened/ })
        .fill("The pay button does nothing on the cart page.");
      await page.getByRole("button", { name: "Send report" }).click();
      await page.getByText("Your report was not sent").waitFor();
      await page.waitForTimeout(300);
      await shot("failure");
      await page.getByRole("textbox", { name: /Title/ }).fill("Checkout fails");
      await page
        .getByRole("textbox", { name: /What happened/ })
        .fill("The pay button does nothing on the cart page.");
      await page
        .getByRole("textbox", { name: /e-mail/i })
        .fill("ada@example.com");
      await page.getByRole("button", { name: "Send report" }).click();
      await page.getByText("We e-mailed you a link").waitFor();
      await page.waitForTimeout(300);
      await shot("done");
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      const focused = await widget.evaluate(
        (el) => el.shadowRoot?.activeElement?.textContent?.trim() ?? null,
      );
      if (focused !== "Report a problem") {
        failed = true;
        console.error(`focus did not return to the launcher (${focused})`);
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
