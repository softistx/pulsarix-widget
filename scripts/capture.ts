/**
 * Captures the widget in the host fixture: 360 and 1440 px, light and dark.
 * Per combination: closed, the open form, its validation errors, a busy refusal (503), a rate limit (429), the confirmation.
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
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.getByText("Enter a title.").waitFor();
      await page.waitForTimeout(300);
      await shot("errors");
      await page.getByRole("textbox", { name: /Title/ }).fill("Checkout busy");
      await page
        .getByRole("textbox", { name: /What happened/ })
        .fill("The pay button does nothing on the cart page.");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.getByText("Your report was not sent").waitFor();
      await page.waitForTimeout(300);
      await shot("failure");
      // Probe: does the failure alert's scrollIntoView move the dialog box itself (header and
      // footer out of place) beside the scrolling body?
      console.log(
        `PROBE ${width}-${scheme}`,
        JSON.stringify(
          await widget.evaluate((el) => {
            const root = el.shadowRoot;
            const box = root?.querySelector('[data-slot="dialog-content"]');
            const header = root?.querySelector('[data-slot="dialog-header"]');
            const body = root?.querySelector('[data-slot="dialog-body"]');
            const footer = root?.querySelector('[data-slot="dialog-footer"]');
            const top = box?.getBoundingClientRect().top ?? 0;
            return {
              boxScrollTop: box?.scrollTop,
              boxScrollable:
                (box?.scrollHeight ?? 0) - (box?.clientHeight ?? 0),
              headerOffset: (header?.getBoundingClientRect().top ?? 0) - top,
              footerBottomGap:
                (box?.getBoundingClientRect().bottom ?? 0) -
                (footer?.getBoundingClientRect().bottom ?? 0),
              bodyScrollTop: body?.scrollTop,
            };
          }),
        ),
      );
      await page
        .getByRole("textbox", { name: /Title/ })
        .fill("Checkout limited");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.getByText("Try again in 10 minutes").waitFor();
      await page.waitForTimeout(300);
      await shot("ratelimit");
      // A rate limit holds Send off: close and open the form again for the next steps.
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await page.getByRole("button", { name: "Report a problem" }).click();
      await page.getByRole("dialog").waitFor();
      // The chosen cards (Bug, Blocking), then a card with keyboard focus (Annoying).
      for (const name of [/^Bug/, /^Blocking/]) {
        const radio = page.getByRole("radio", { name });
        await radio.scrollIntoViewIfNeeded();
        await radio.check({ force: true });
      }
      // The pointer rests on the last card clicked: move it away so no hover tint reaches the shot.
      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);
      await shot("choices-selected");
      await page.getByRole("radio", { name: /^Blocking/ }).focus();
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);
      await shot("choices-focus");
      await page.getByRole("textbox", { name: /Title/ }).fill("Checkout fails");
      await page
        .getByRole("textbox", { name: /What happened/ })
        .fill("The pay button does nothing on the cart page.");
      await page
        .getByRole("textbox", { name: /e-mail/i })
        .fill("ada@example.com");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.getByText("We e-mailed you a link").waitFor();
      await page.waitForTimeout(300);
      await shot("done");
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      const focused = await widget.evaluate(
        (el) =>
          el.shadowRoot?.activeElement?.getAttribute("aria-label") ?? null,
      );
      if (focused !== "Report a problem") {
        failed = true;
        console.error(`focus did not return to the launcher (${focused})`);
      }
      await page.close();
    }
  }
  // The confirmation of an identified reporter (My requests), and the form in French.
  for (const [width, height] of [
    [360, 780],
    [1440, 900],
  ] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: scheme,
      });
      const page = await context.newPage();
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
      await page.getByRole("button", { name: /^Report a problem/ }).click();
      await page
        .getByRole("menuitem", { name: /Report a problem|Report/ })
        .first()
        .click()
        .catch(() => {});
      await page.getByRole("dialog").waitFor();
      await page.getByRole("textbox", { name: /Title/ }).fill("Checkout fails");
      await page
        .getByRole("textbox", { name: /What happened/ })
        .fill("The pay button does nothing on the cart page.");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.getByRole("button", { name: "My requests" }).waitFor();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `${out}/done-identified-${width}-${scheme}.png`,
      });
      await context.close();
      const fr = await (
        await browser.newContext({
          viewport: { width, height },
          colorScheme: scheme,
        })
      ).newPage();
      await fr.goto(`http://localhost:${server.port}/`);
      await fr.waitForFunction(() =>
        document
          .querySelector("pulsarix-widget")
          ?.shadowRoot?.querySelector("button"),
      );
      await fr.evaluate((s) => {
        const el = document.querySelector("pulsarix-widget");
        el?.setAttribute("theme", s);
        el?.setAttribute("locale", "fr");
      }, scheme);
      await fr.getByRole("button", { name: "Signaler un problème" }).click();
      await fr.getByRole("dialog").waitFor();
      await fr.waitForTimeout(500);
      await fr.screenshot({ path: `${out}/form-fr-${width}-${scheme}.png` });
      await fr.getByRole("button", { name: "Envoyer", exact: true }).click();
      await fr.getByText("Saisissez un titre.").waitFor();
      await fr.waitForTimeout(300);
      await fr.screenshot({ path: `${out}/errors-fr-${width}-${scheme}.png` });
      await fr.context().close();
    }
  }
} finally {
  await browser.close();
  server.stop(true);
}
if (failed) process.exit(1);
console.log(`captures in ${out}`);
