/**
 * Captures the attached-files section (W2c): 360 and 1440 px, light and dark. Per combination:
 * the empty drop zone, files listed, a refusal, an upload in progress, and the confirmation of
 * a partial failure.
 * Usage: bun scripts/capture-files.ts <out-dir>
 */
import { mkdirSync } from "node:fs";
import type { Page } from "playwright-core";
import { chromium } from "playwright-core";
import { filesInput, fillAndSend, openWidget, png } from "./files-test";
import { serveFixture } from "./serve-fixture";

const out = process.argv[2] ?? "captures-files";
mkdirSync(out, { recursive: true });
const server = serveFixture(0);
const base = `http://localhost:${server.port}`;
const browser = await chromium.launch();
let failed = false;

const shot = async (page: Page, name: string, w: number, scheme: string) => {
  await page
    .locator("pulsarix-widget [data-testid=attachments]")
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-${w}-${scheme}.png` });
};

try {
  for (const [width, height] of [
    [360, 780],
    [1440, 900],
  ] as const) {
    for (const scheme of ["light", "dark"] as const) {
      try {
        const a = await openWidget(browser, `${base}/`, {
          width,
          height,
          scheme,
        });
        await shot(a.page, "1-empty", width, scheme);
        await filesInput(a.page).setInputFiles([
          png("checkout-error.png", 48_000),
          {
            name: "console-log.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.alloc(220_000, 1),
          },
        ]);
        await a.page.waitForTimeout(400);
        await shot(a.page, "2-listed", width, scheme);
        await filesInput(a.page).setInputFiles([
          {
            name: "notes.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("x"),
          },
        ]);
        await a.page
          .getByText("Not accepted", { exact: false })
          .first()
          .waitFor();
        await shot(a.page, "3-refused", width, scheme);
        await a.context.close();

        // Progress: the stub answers the PUT of a file named "slow…" after a pause.
        const b = await openWidget(browser, `${base}/`, {
          width,
          height,
          scheme,
        });
        await filesInput(b.page).setInputFiles([
          png("slow-trace.png", 400_000),
        ]);
        await fillAndSend(b.page);
        await b.page.waitForTimeout(4200);
        await shot(b.page, "4-uploading", width, scheme);
        await b.context.close();

        const c = await openWidget(browser, `${base}/`, {
          width,
          height,
          scheme,
        });
        await filesInput(c.page).setInputFiles([
          png("trace.png"),
          png("fail-me.png", 4096),
        ]);
        await fillAndSend(c.page);
        await c.page.getByText("Some files were not attached").waitFor();
        await c.page.waitForTimeout(400);
        await c.page.screenshot({
          path: `${out}/5-partial-${width}-${scheme}.png`,
        });
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
