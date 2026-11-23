/**
 * The privacy slice's acceptance (W3c), run in Chromium against the fixture stub, under a strict
 * CSP (`/strict-identified`: `connect-src 'self'`, no `blob:` image source):
 *   - the e-mail switch starts from `emailsOn`, flips at once and the choice reaches the API;
 *   - a refused choice (429, `/strict-limited`) rolls back with a message;
 *   - "Delete my data" opens a confirm dialog inside the shadow root: Cancel erases nothing, the
 *     action erases, the list empties, `pulsarix:erase {requests}` and `pulsarix:unread {0}` fire;
 *   - a refused erase keeps the dialog open with the reason;
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

const HOOK = `
  window.__csp = [];
  document.addEventListener("securitypolicyviolation", (e) =>
    window.__csp.push(e.violatedDirective + " " + e.blockedURI));
  window.__events = [];
  const hook = () => {
    const el = document.querySelector("pulsarix-widget");
    if (!el) return requestAnimationFrame(hook);
    for (const name of ["pulsarix:unread", "pulsarix:erase"])
      el.addEventListener(name, (e) => window.__events.push({ name, detail: e.detail }));
  };
  hook();
`;

const server = serveFixture(0);
const base = `http://localhost:${server.port}`;
const privacy = async () =>
  (await (await fetch(`${base}/__privacy`)).json()) as {
    setRequestEmails: boolean[];
    eraseMyData: number;
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

async function openList(page: Page, path: string) {
  await page.goto(`${base}${path}`);
  await page.getByRole("button", { name: /Report a problem/ }).click();
  await page.getByRole("menuitem", { name: /My requests/ }).click();
  await page
    .getByRole("button", { name: /Open request: /i })
    .first()
    .waitFor();
  // The e-mail choice and "Delete my data" are in the preferences view, behind the header's gear.
  await page.getByRole("button", { name: "Preferences" }).click();
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(HOOK);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // A refused choice rolls back.
  await openList(page, "/strict-limited");
  const limited = page.getByRole("switch", {
    name: /E-mails about my requests/,
  });
  check(
    (await limited.getAttribute("aria-checked")) === "true",
    "the switch starts from emailsOn (on)",
  );
  await limited.click();
  await page.getByText(/choice was not saved/).waitFor();
  check(
    (await limited.getAttribute("aria-checked")) === "true",
    "a refused choice (429) rolls the switch back and says so",
  );
  // A refused erase keeps the dialog open.
  await page.getByRole("button", { name: "Delete my data" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByText(/Too many requests. Try again in 10 minutes/).waitFor();
  check(
    (await page.getByRole("alertdialog").count()) === 1,
    "a refused erase keeps the confirm dialog open with the reason",
  );
  await page.getByRole("button", { name: "Cancel" }).click();

  // The e-mail choice, then erase.
  await openList(page, "/strict-identified");
  const toggle = page.getByRole("switch", {
    name: /E-mails about my requests/,
  });
  await toggle.click();
  check(
    (await toggle.getAttribute("aria-checked")) === "false",
    "the switch flips at once",
  );
  check(
    await until(
      async () => (await privacy()).setRequestEmails.at(-1) === false,
    ),
    "the choice reaches the API",
  );

  await page.getByRole("button", { name: "Delete my data" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor();
  check(
    await page
      .locator("pulsarix-widget")
      .evaluate((el) => !!el.shadowRoot?.querySelector('[role="alertdialog"]')),
    "the confirm dialog opens inside the shadow root",
  );
  await page.getByRole("button", { name: "Cancel" }).click();
  await dialog.waitFor({ state: "detached" });
  check((await privacy()).eraseMyData === 0, "Cancel erases nothing");

  await page.getByRole("button", { name: "Delete my data" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByText("6 requests erased.").waitFor();
  check(
    (await page.getByRole("button", { name: /Open request: /i }).count()) === 0,
    "the list is empty after the erase",
  );
  check(
    await until(async () => {
      const seen = await events(page);
      return (
        seen.some(
          (e) =>
            e.name === "pulsarix:erase" &&
            (e.detail as { requests: number }).requests === 6,
        ) &&
        seen.some(
          (e) =>
            e.name === "pulsarix:unread" &&
            (e.detail as { count: number }).count === 0,
        )
      );
    }),
    "pulsarix:erase {requests: 6} and pulsarix:unread {count: 0} reach the page",
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
console.log("\nprivacy test: all checks passed");
