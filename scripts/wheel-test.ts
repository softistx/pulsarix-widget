/**
 * Touchpad / wheel scrolling inside the report dialog (a modal in a shadow root). Opens the form in
 * a short viewport so its body overflows, wheels over it and asserts the scroll container moved.
 * A browser test: local only, never in CI.
 */
import { chromium } from "playwright-core";
import { serveFixture } from "./serve-fixture";

const server = serveFixture(0);
const browser = await chromium.launch();
let failed = false;
try {
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 520 } })
  ).newPage();
  await page.goto(`http://localhost:${server.port}/`);
  await page.waitForFunction(() =>
    document
      .querySelector("pulsarix-widget")
      ?.shadowRoot?.querySelector("button"),
  );
  await page.getByRole("button", { name: "Report a problem" }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(500);
  const probe = () =>
    page.evaluate(() => {
      const root = document.querySelector("pulsarix-widget")?.shadowRoot;
      const dialog = root?.querySelector('[role="dialog"]');
      const found = [...(dialog?.querySelectorAll("*") ?? [])].find(
        (el) =>
          el.scrollHeight > el.clientHeight + 4 &&
          /auto|scroll/.test(getComputedStyle(el).overflowY),
      );
      return found
        ? { top: found.scrollTop, max: found.scrollHeight - found.clientHeight }
        : null;
    });
  const before = await probe();
  const box = await page.getByRole("dialog").boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(400);
  const after = await probe();
  const ok = !!before && !!after && after.top > before.top;
  console.log(
    `${ok ? "PASS" : "FAIL"}  wheel scrolls the report form`,
    before,
    after,
  );
  failed = !ok;
} finally {
  await browser.close();
  server.stop();
}
process.exit(failed ? 1 : 0);
