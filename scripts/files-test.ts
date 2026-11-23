/**
 * The attached-files slice's acceptance (W2c), run in Chromium against the fixture stub, under a
 * strict CSP (`/strict`: `connect-src 'self'`, no inline style but the host's own, no `blob:`
 * image source):
 *   - chosen files are uploaded by ticket (a PUT each) and the confirmation counts them;
 *   - a refused file is shown with its reason and is never sent;
 *   - a file the API cannot take is a partial failure, worded in the confirmation;
 *   - `data-attachments="false"` (the `attachments` attribute) hides the controls;
 *   - the page raised no CSP violation and no error.
 * A browser test: local only, never in CI (see "Browser tests" in the owner's rules).
 */
import { type Browser, chromium, type Page } from "playwright-core";
import { serveFixture } from "./serve-fixture";

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${message}`);
  if (!ok) failures.push(message);
};

const VIOLATIONS = `
  window.__csp = [];
  document.addEventListener("securitypolicyviolation", (e) =>
    window.__csp.push(e.violatedDirective + " " + e.blockedURI));
`;

export const png = (name: string, bytes = 2048) => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.alloc(bytes, 1),
});

export async function openWidget(
  browser: Browser,
  base: string,
  options: { width?: number; height?: number; scheme?: "light" | "dark" } = {},
) {
  const context = await browser.newContext({
    viewport: { width: options.width ?? 1440, height: options.height ?? 900 },
    colorScheme: options.scheme ?? "light",
  });
  await context.addInitScript(VIOLATIONS);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base);
  await page.waitForFunction(() =>
    document
      .querySelector("pulsarix-widget")
      ?.shadowRoot?.querySelector("button"),
  );
  if (options.scheme)
    await page.evaluate(
      (s) =>
        document.querySelector("pulsarix-widget")?.setAttribute("theme", s),
      options.scheme,
    );
  await page.getByRole("button", { name: "Report a problem" }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(400);
  return { page, context, errors };
}

/** The files input of the "Files" section (the screenshot pane has its own). */
export const filesInput = (page: Page) =>
  page.locator('pulsarix-widget [data-testid="attachments-input"]');

/**
 * Chooses files. An image opens the editor right away (the first one, when several are chosen):
 * cancelling it keeps the file as chosen, so the form comes back with its list.
 */
export async function chooseFiles(
  page: Page,
  files: Parameters<ReturnType<typeof filesInput>["setInputFiles"]>[0],
  cancel = "Cancel",
) {
  await filesInput(page).setInputFiles(files);
  const list = Array.isArray(files) ? files : [files];
  const opensEditor = list.some(
    (f) =>
      typeof f !== "string" && "mimeType" in f && f.mimeType === "image/png",
  );
  if (opensEditor)
    await page.getByRole("button", { name: cancel, exact: true }).click();
}

export async function fillAndSend(page: Page) {
  await page.getByRole("textbox", { name: /Title/ }).fill("Checkout fails");
  await page
    .getByRole("textbox", { name: /What happened/ })
    .fill("Pay does nothing");
  await page.getByRole("button", { name: "Send", exact: true }).click();
}

const puts = async (base: string) =>
  (await (await fetch(`${base}/__puts`)).json()) as {
    name: string;
    bytes: number;
    type: string;
  }[];

if (import.meta.main) {
  const server = serveFixture(0);
  const base = `http://localhost:${server.port}`;
  const browser = await chromium.launch();
  try {
    {
      const { page, context, errors } = await openWidget(
        browser,
        `${base}/strict`,
      );
      await chooseFiles(page, [
        png("trace.png"),
        {
          name: "notes.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("hi"),
        },
        png("fail-me.png", 4096),
      ]);
      await page.getByText("Not accepted", { exact: false }).first().waitFor();
      check(true, "a text file is refused with its reason");
      await fillAndSend(page);
      await page.getByText("Some files were not attached").waitFor();
      check(true, "a file the API cannot take is a partial failure, worded");
      const sent = await puts(base);
      check(
        sent.length === 1 &&
          sent[0]?.name === "trace.png" &&
          sent[0].bytes === 2048,
        "the good file was PUT with its own bytes, once; the refused one never left",
      );
      check(
        sent[0]?.type === "image/png",
        "the PUT carries the file's content type",
      );
      const violations = await page.evaluate(
        () => (window as unknown as { __csp: string[] }).__csp,
      );
      check(
        violations.length === 0,
        `no CSP violation under the strict policy (${violations.join("; ") || "none"})`,
      );
      check(
        errors.length === 0,
        `no page error (${errors.join("; ") || "none"})`,
      );
      await context.close();
    }
    {
      const { page, context } = await openWidget(browser, `${base}/strict`);
      await chooseFiles(page, [png("a.png"), png("b.png")]);
      await fillAndSend(page);
      await page.getByText("Your 2 files are attached.").waitFor();
      check(true, "two files are attached and the confirmation counts them");
      await context.close();
    }
    {
      const { page, context } = await openWidget(browser, `${base}/`);
      await page.evaluate(() =>
        document
          .querySelector("pulsarix-widget")
          ?.setAttribute("attachments", "false"),
      );
      await page.waitForTimeout(300);
      check(
        (await filesInput(page).count()) === 0,
        'data-attachments="false" hides the files controls',
      );
      await context.close();
    }
  } finally {
    await browser.close();
    server.stop(true);
  }
  if (failures.length) {
    console.error(`${failures.length} failed`);
    process.exit(1);
  }
}
