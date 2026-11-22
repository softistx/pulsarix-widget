/**
 * The request-thread slice's acceptance (W3b), run in Chromium against the fixture stub, under a
 * strict CSP (`/strict-identified`: `connect-src 'self'`, no `blob:` image source):
 *   - a thread opens from My requests and the live stream opens with it (`fetch`, identity header);
 *   - a reply with a file goes up by ticket; a team reply reaches the open thread through the stream;
 *   - `pulsarix:unread` and `pulsarix:reply` reach the host page;
 *   - the stream stops on Back and on close;
 *   - Resolve then Reopen; a declined request is read-only with its reason;
 *   - no CSP violation and no page error.
 * A browser test: local only, never in CI (see "Browser tests" in the owner's rules).
 */
import { chromium, type Page } from "playwright-core";
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
  window.__events = [];
  const hook = () => {
    const el = document.querySelector("pulsarix-widget");
    if (!el) return requestAnimationFrame(hook);
    for (const name of ["pulsarix:unread", "pulsarix:reply"])
      el.addEventListener(name, (e) => window.__events.push({ name, detail: e.detail }));
  };
  hook();
`;

const server = serveFixture(0);
const base = `http://localhost:${server.port}`;
const live = async () =>
  (await (await fetch(`${base}/__live`)).json()) as {
    open: number;
    opened: number;
    closed: number;
  };
async function until(test: () => Promise<boolean>, ms = 5_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await test()) return true;
    await Bun.sleep(100);
  }
  return false;
}
const events = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __events: { name: string; detail: unknown }[] })
        .__events,
  );

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(VIOLATIONS);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/strict-identified`);
  await page.getByRole("button", { name: /Report a problem/ }).click();
  await page.getByRole("button", { name: /My requests/ }).click();
  check(
    (await live()).open === 0,
    "no stream runs while only the list is open",
  );

  // The thread of an unread request.
  await page
    .getByRole("button", { name: /Open request: How do I change/ })
    .click();
  await page.getByText("It is under Account, then Billing").waitFor();
  check(
    await until(async () => (await live()).open === 1),
    "the live stream opens with the thread",
  );
  check(
    await until(async () =>
      (await events(page)).some(
        (e) =>
          e.name === "pulsarix:unread" &&
          (e.detail as { count: number }).count === 1,
      ),
    ),
    "opening the thread marks it read: pulsarix:unread {count: 1} (3 unread before)",
  );

  // A reply with a file.
  await page.getByPlaceholder("Write a reply...").fill("Thanks, found it");
  await page
    .locator('pulsarix-widget input[type="file"]')
    .first()
    .setInputFiles({
      name: "result.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(2048, 1),
    });
  check(
    await page
      .getByText("result.png")
      .first()
      .waitFor({ timeout: 3000 })
      .then(() => true)
      .catch(() => false),
    "the composer shows the attached file",
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText("Thanks, found it").waitFor();
  const putsNow = async () =>
    (await (await fetch(`${base}/__puts`)).json()) as {
      name: string;
      bytes: number;
    }[];
  check(
    await until(async () =>
      (await putsNow()).some(
        (p) => p.name === "result.png" && p.bytes === 2048,
      ),
    ),
    "the reply's file was PUT by its ticket",
  );

  // The team answers: the stream refreshes the thread, the page hears it.
  await fetch(`${base}/__team-reply`, {
    method: "POST",
    body: JSON.stringify({ id: "r2", body: "Glad it helped!" }),
  });
  await page.getByText("Glad it helped!").waitFor();
  check(
    await until(async () =>
      (await events(page)).some((e) => e.name === "pulsarix:reply"),
    ),
    "a team reply reaches the open thread and pulsarix:reply",
  );

  // Resolve, Reopen.
  await page.getByRole("button", { name: "Resolve" }).click();
  await page.getByRole("button", { name: "Reopen" }).waitFor();
  await page.getByRole("button", { name: "Reopen" }).click();
  await page.getByRole("button", { name: "Resolve" }).waitFor();
  check(true, "Resolve then Reopen");

  // Back stops the stream.
  await page.getByRole("button", { name: "Back" }).click();
  check(
    await until(async () => (await live()).open === 0),
    "the stream stops on Back",
  );

  // A declined request is read-only.
  await page.getByRole("radio", { name: /^Declined/ }).click();
  await page
    .getByRole("button", { name: /Open request: Add a dark mode/ })
    .click();
  await page.getByText("Not planned for this year.").waitFor();
  check(
    (await page.getByPlaceholder("Write a reply...").count()) === 0,
    "a declined request has no composer and shows its reason",
  );

  // Close stops the stream of an open thread.
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("radio", { name: /^Open/ }).click();
  await page
    .getByRole("button", { name: /Open request: The pay button/ })
    .click();
  await page.getByText("A fix is in progress").waitFor();
  check(
    await until(async () => (await live()).open === 1),
    "the stream reopens with another thread",
  );
  await page.keyboard.press("Escape");
  check(
    await until(async () => (await live()).open === 0),
    "the stream stops when the dialog closes",
  );

  const violations = await page.evaluate(
    () => (window as unknown as { __csp: string[] }).__csp,
  );
  check(
    violations.length === 0,
    `no CSP violation under the strict policy (${violations.join("; ") || "none"})`,
  );
  check(errors.length === 0, `no page error (${errors.join("; ") || "none"})`);
  await context.close();
} finally {
  await browser.close();
  server.stop(true);
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nthread test: all checks passed");
