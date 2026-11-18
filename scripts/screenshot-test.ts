/**
 * The screenshot slice's acceptance (W2b), run in Chromium with fake display media:
 *   - "Add a screenshot" hides the widget host while the frame is grabbed, restores it, and
 *     leaves no media track live and no object URL behind;
 *   - the editor (a lazy chunk) annotates; the exported pixels under a "Redact" box are one
 *     uniform colour, and the export is at most 2560 px on its longest side;
 *   - "Upload an image" works, refuses what it cannot take, and is the only choice on a phone;
 *   - a refused capture falls back to the upload; retake and remove work.
 * A browser test: local only, never in CI (see "Browser tests" in the owner's rules).
 */
import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page,
} from "playwright-core";
import { serveFixture } from "./serve-fixture";

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${message}`);
  if (!ok) failures.push(message);
};

/** Fake display media: Chromium serves a test pattern as the "screen" and never asks. */
export const FAKE_MEDIA_ARGS = [
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  "--auto-select-desktop-capture-source=Entire screen",
];

/** Records what the page asks of the media API and of object URLs; reads nothing of the widget. */
const SPY = `
  window.__spy = { calls: [], streams: [], urls: { created: 0, revoked: 0 } };
  const real = navigator.mediaDevices?.getDisplayMedia?.bind(navigator.mediaDevices);
  if (real) {
    navigator.mediaDevices.getDisplayMedia = async (constraints) => {
      const host = document.querySelector("pulsarix-widget");
      window.__spy.calls.push(host ? getComputedStyle(host).visibility : "none");
      const stream = await real(constraints);
      window.__spy.streams.push(stream);
      return stream;
    };
  }
  const create = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (o) => { window.__spy.urls.created++; return create(o); };
  URL.revokeObjectURL = (u) => { window.__spy.urls.revoked++; return revoke(u); };
`;

const REFUSE = `
  navigator.mediaDevices.getDisplayMedia = async () => {
    throw new DOMException("Permission denied", "NotAllowedError");
  };
`;

const PHONE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

async function open(
  browser: Browser,
  options: {
    width?: number;
    height?: number;
    userAgent?: string;
    init?: string;
  },
  base: string,
): Promise<{ page: Page; context: BrowserContext; errors: string[] }> {
  const context = await browser.newContext({
    viewport: { width: options.width ?? 1440, height: options.height ?? 900 },
    userAgent: options.userAgent,
  });
  await context.addInitScript(SPY);
  if (options.init) await context.addInitScript(options.init);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/`);
  await page.waitForFunction(() =>
    document
      .querySelector("pulsarix-widget")
      ?.shadowRoot?.querySelector("button"),
  );
  await page.getByRole("button", { name: "Report a problem" }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(400);
  return { page, context, errors };
}

/** A PNG with some structure, made in the page (a canvas), as bytes. */
async function pngBytes(page: Page, width: number, height: number) {
  const base64 = await page.evaluate(
    async ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      ctx.fillStyle = "#1f6feb";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#f5c518";
      ctx.fillRect(width * 0.1, height * 0.1, width * 0.3, height * 0.4);
      ctx.fillStyle = "#e03131";
      ctx.fillRect(width * 0.5, height * 0.5, width * 0.4, height * 0.4);
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b as Blob), "image/png"),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let text = "";
      for (const b of bytes) text += String.fromCharCode(b);
      return btoa(text);
    },
    { width, height },
  );
  return Buffer.from(base64, "base64");
}

/** A drawing tool of the editor, by its label (a toggle, not a plain button). */
const tool = (page: Page, name: string) =>
  page.locator(`pulsarix-widget [aria-label="${name}"]`);
const stage = (page: Page) => page.locator("pulsarix-widget canvas").first();
const preview = (page: Page) => page.getByTestId("screenshot-preview");

/** Draws on the editor's stage between two fractions of the image, with the mouse. */
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const box = await stage(page).boundingBox();
  if (!box) throw new Error("no stage");
  await page.mouse.move(
    box.x + box.width * from[0],
    box.y + box.height * from[1],
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * ((from[0] + to[0]) / 2),
    box.y + box.height * ((from[1] + to[1]) / 2),
    { steps: 4 },
  );
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], {
    steps: 4,
  });
  await page.mouse.up();
}

/** The kept image, read back from the preview canvas: size and the colours inside a region. */
function regionOf(
  page: Page,
  fractions: [number, number, number, number],
  inset: number,
) {
  return page.evaluate(
    ({ fractions, inset }) => {
      const host = document.querySelector("pulsarix-widget");
      const canvas = host?.shadowRoot?.querySelector(
        '[data-testid="screenshot-preview"]',
      ) as HTMLCanvasElement;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      const [fx0, fy0, fx1, fy1] = fractions as [
        number,
        number,
        number,
        number,
      ];
      const x0 = Math.round(canvas.width * fx0) + inset;
      const y0 = Math.round(canvas.height * fy0) + inset;
      const x1 = Math.round(canvas.width * fx1) - inset;
      const y1 = Math.round(canvas.height * fy1) - inset;
      const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      const colours = new Set<number>();
      for (let i = 0; i < data.length; i += 4)
        colours.add(
          ((data[i] as number) << 24) |
            ((data[i + 1] as number) << 16) |
            ((data[i + 2] as number) << 8) |
            (data[i + 3] as number),
        );
      return {
        width: canvas.width,
        height: canvas.height,
        pixels: data.length / 4,
        distinct: colours.size,
        alpha: data[3],
      };
    },
    { fractions, inset },
  );
}

const spy = (page: Page) =>
  page.evaluate(() => {
    const s = (
      window as unknown as {
        __spy: {
          calls: string[];
          streams: MediaStream[];
          urls: { created: number; revoked: number };
        };
      }
    ).__spy;
    return {
      calls: s.calls,
      streams: s.streams.length,
      live: s.streams
        .flatMap((m) => m.getTracks())
        .filter((t) => t.readyState !== "ended").length,
      urls: s.urls,
    };
  });

const server = serveFixture(0);
const base = `http://localhost:${server.port}`;
const browser = await chromium.launch({ args: FAKE_MEDIA_ARGS });
try {
  // 1. Capture, annotate, hide, keep.
  {
    const { page, context, errors } = await open(browser, {}, base);
    await page.getByRole("textbox", { name: /Title/ }).fill("Checkout broken");
    await page.evaluate(() => {
      (
        document.querySelector("pulsarix-widget") as HTMLElement & {
          __kept?: boolean;
        }
      ).__kept = true;
    });
    await page.getByRole("button", { name: "Add a screenshot" }).click();
    await tool(page, "Redact").waitFor();
    await page.waitForTimeout(500);
    const during = await spy(page);
    check(
      during.calls.length === 1,
      "one getDisplayMedia call for one capture",
    );
    check(
      during.calls[0] === "hidden",
      `the host is hidden when the capture starts (${during.calls[0]})`,
    );
    check(during.live === 0, "no media track left live once the frame is read");
    const restored = await page.evaluate(() => {
      const host = document.querySelector("pulsarix-widget") as HTMLElement & {
        __kept?: boolean;
      };
      return {
        visibility: getComputedStyle(host).visibility,
        kept: host.__kept,
        inline: host.style.visibility,
      };
    });
    check(
      restored.visibility === "visible" &&
        restored.inline === "" &&
        restored.kept === true,
      "the host is restored (same element, no inline style left)",
    );
    check(
      (await page.getByRole("textbox", { name: /Title/ }).inputValue()) ===
        "Checkout broken",
      "the form kept its text (the host was hidden, not unmounted)",
    );

    // A pen stroke, then a "Redact" box over the middle of the picture.
    await tool(page, "Pen").click();
    await drag(page, [0.1, 0.12], [0.35, 0.2]);
    await tool(page, "Redact").click();
    // The panel always renders its Size control: wait for it so the count below is not vacuous.
    const panel = page.locator("pulsarix-widget");
    await panel
      .getByText("Size")
      .or(panel.getByLabel("Size"))
      .first()
      .waitFor();
    check(
      (await page
        .locator("pulsarix-widget")
        .getByText(/pixelate/i)
        .count()) === 0,
      "the Redact tool offers no pixelate option (solid masking only)",
    );
    await drag(page, [0.4, 0.3], [0.75, 0.85]);
    await page.getByRole("button", { name: "Attach" }).click();
    await preview(page).waitFor();
    await page.waitForFunction(() => {
      const c = document
        .querySelector("pulsarix-widget")
        ?.shadowRoot?.querySelector(
          '[data-testid="screenshot-preview"]',
        ) as HTMLCanvasElement | null;
      return !!c && c.width > 300;
    });
    const hidden = await regionOf(page, [0.4, 0.3, 0.75, 0.85], 6);
    check(
      hidden.distinct === 1 && hidden.alpha === 255 && hidden.pixels > 10_000,
      `the pixels under the Redact box are one opaque colour (${hidden.distinct} colour, ${hidden.pixels} px)`,
    );
    const stroke = await regionOf(page, [0.08, 0.1, 0.37, 0.22], 0);
    check(
      stroke.distinct > 1,
      "the pen stroke outside the box is kept (the export is annotated, not blanked)",
    );
    check(
      Math.max(hidden.width, hidden.height) <= 2560,
      `the export is at most 2560 px (${hidden.width}x${hidden.height})`,
    );
    const after = await spy(page);
    check(after.live === 0, "no media track live after the editor saved");
    check(
      after.urls.created === after.urls.revoked,
      `no object URL left (${after.urls.created} created, ${after.urls.revoked} revoked)`,
    );
    check(
      (await page.getByRole("button", { name: "Retake" }).count()) === 1 &&
        (await page.getByRole("button", { name: "Remove" }).count()) === 1,
      "Retake and Remove are offered",
    );

    // Retake: a second capture, then cancel keeps the first export.
    await page.getByRole("button", { name: "Retake" }).click();
    await page.getByRole("button", { name: "Cancel" }).waitFor();
    await page.getByRole("button", { name: "Cancel" }).click();
    await preview(page).waitFor();
    const again = await spy(page);
    check(
      again.calls.length === 2 && again.live === 0,
      "retake takes a new capture and ends its tracks",
    );
    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("button", { name: "Add a screenshot" }).waitFor();
    check((await preview(page).count()) === 0, "Remove drops the export");
    check(
      errors.length === 0,
      `no page errors${errors.length ? `: ${errors[0]}` : ""}`,
    );
    await context.close();
  }

  // 2. Upload: a large image is brought down to 2560 px; a wrong type is refused.
  {
    const { page, context } = await open(browser, {}, base);
    await page.getByTestId("screenshot-file").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });
    check(
      await page.getByText("Choose a PNG, JPEG or WebP image.").isVisible(),
      "an upload that is not an image is refused with a message",
    );
    await page.getByTestId("screenshot-file").setInputFiles({
      name: "wide.png",
      mimeType: "image/png",
      buffer: await pngBytes(page, 4000, 2000),
    });
    await page.getByRole("button", { name: "Attach" }).click();
    await preview(page).waitFor();
    await page.waitForFunction(() => {
      const c = document
        .querySelector("pulsarix-widget")
        ?.shadowRoot?.querySelector(
          '[data-testid="screenshot-preview"]',
        ) as HTMLCanvasElement | null;
      return !!c && c.width > 300;
    });
    const size = await regionOf(page, [0, 0, 1, 1], 0);
    check(
      size.width === 2560 && size.height === 1280,
      `a 4000x2000 upload is exported at 2560x1280 (${size.width}x${size.height})`,
    );
    check(
      (await spy(page)).calls.length === 0,
      "an upload never asks for the screen",
    );
    await context.close();
  }

  // 3. A refused capture falls back to the upload.
  {
    const { page, context } = await open(browser, { init: REFUSE }, base);
    await page.getByRole("button", { name: "Add a screenshot" }).click();
    await page.getByText("The capture was refused.").waitFor();
    check(
      await page.getByRole("button", { name: "Upload an image" }).isEnabled(),
      "after a refusal the upload is still offered",
    );
    await context.close();
  }

  // 4. A phone: no screen capture, the upload alone.
  {
    const { page, context } = await open(
      browser,
      { width: 360, height: 780, userAgent: PHONE_UA },
      base,
    );
    check(
      (await page.getByRole("button", { name: "Add a screenshot" }).count()) ===
        0,
      "no screen-capture button on a phone",
    );
    check(
      await page.getByRole("button", { name: "Upload an image" }).isVisible(),
      "Upload an image is offered on a phone",
    );
    await context.close();
  }
} finally {
  await browser.close();
  server.stop(true);
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nscreenshot test: all checks passed");
