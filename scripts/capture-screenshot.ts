/**
 * Captures the screenshot pane (W2b): 360 and 1440 px, light and dark. Per combination:
 * the empty pane, the editor open, the annotated and kept preview, the upload-only fallback
 * (capture refused), and the mask-text option turned on. Fake display media, like the spec.
 * Usage: bun scripts/capture-screenshot.ts <out-dir>
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { serveFixture } from "./serve-fixture";

const out = process.argv[2] ?? "captures-screenshot";
mkdirSync(out, { recursive: true });
const server = serveFixture(0);
const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--auto-select-desktop-capture-source=Entire screen",
  ],
});
const REFUSE = `navigator.mediaDevices.getDisplayMedia = async () => {
  throw new DOMException("Permission denied", "NotAllowedError");
};`;
const tool = (page: Page, name: string) =>
  page.locator(`pulsarix-widget [aria-label="${name}"]`);

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const box = await page
    .locator("pulsarix-widget canvas")
    .first()
    .boundingBox();
  if (!box) throw new Error("no stage");
  const at = (f: [number, number]) =>
    [box.x + box.width * f[0], box.y + box.height * f[1]] as const;
  await page.mouse.move(...at(from));
  await page.mouse.down();
  await page.mouse.move(...at(to), { steps: 8 });
  await page.mouse.up();
}

const notice = (page: Page) =>
  page
    .getByTestId("screenshot-pane")
    .locator('[role="status"]:not(:empty)')
    .waitFor();

let failed = false;
try {
  for (const [width, height] of [
    [360, 780],
    [1440, 900],
  ] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const open = async (init?: string) => {
        const context = await browser.newContext({
          viewport: { width, height },
          colorScheme: scheme,
        });
        if (init) await context.addInitScript(init);
        const page = await context.newPage();
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
        await page.getByRole("button", { name: "Report a problem" }).click();
        await page.getByRole("dialog").waitFor();
        await page.waitForTimeout(500);
        return { page, context };
      };
      const shot = async (page: Page, name: string) => {
        await page
          .getByTestId("screenshot-pane")
          .evaluate((el) => el.scrollIntoView({ block: "center" }));
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `${out}/${name}-${width}-${scheme}.png`,
        });
      };
      try {
        const a = await open();
        await shot(a.page, "pane-empty");
        await a.page.getByRole("checkbox").check();
        await shot(a.page, "pane-mask-text");
        await a.page.getByRole("button", { name: "Add a screenshot" }).click();
        await notice(a.page);
        await a.page.waitForTimeout(600);
        await shot(a.page, "pane-mask-text-result");
        await a.context.close();

        const b = await open();
        await b.page.getByRole("button", { name: "Add a screenshot" }).click();
        await tool(b.page, "Redact").waitFor();
        await b.page.waitForTimeout(600);
        await shot(b.page, "editor");
        await tool(b.page, "Pen").click();
        await drag(b.page, [0.1, 0.12], [0.35, 0.2]);
        await tool(b.page, "Redact").click();
        await drag(b.page, [0.4, 0.3], [0.75, 0.85]);
        await b.page.waitForTimeout(300);
        await shot(b.page, "editor-annotated");
        // The pane scrolls on its own: every tool row is reachable at the bottom.
        await b.page.evaluate(() => {
          const aside = document
            .querySelector("pulsarix-widget")
            ?.shadowRoot?.querySelector("[data-slot=dialog-aside]");
          aside?.scrollTo(0, aside.scrollHeight);
          for (const el of document
            .querySelector("pulsarix-widget")
            ?.shadowRoot?.querySelectorAll("[data-slot=dialog-content]") ?? [])
            el.scrollTo(0, el.scrollHeight);
        });
        await b.page.waitForTimeout(300);
        await b.page.screenshot({
          path: `${out}/editor-annotated-scrolled-${width}-${scheme}.png`,
        });
        await b.page.getByRole("button", { name: "Attach" }).click();
        await b.page.getByTestId("screenshot-preview").waitFor();
        await b.page.waitForTimeout(500);
        await shot(b.page, "pane-kept");
        await b.context.close();

        const c = await open(REFUSE);
        await c.page.getByRole("button", { name: "Add a screenshot" }).click();
        await notice(c.page);
        await c.page.waitForTimeout(400);
        await shot(c.page, "pane-upload-fallback");
        await c.context.close();
      } catch (error) {
        failed = true;
        console.error(`${width} ${scheme}: ${error}`);
      }
    }
  }
} finally {
  await browser.close();
  server.stop(true);
}
if (failed) process.exit(1);
console.log(`captures in ${out}`);
