/**
 * Captures "My requests" in the host fixture: 360 and 1440 px, light and dark.
 *   fab       the FAB, unread count in its name (identified)
 *   menu      the anchored menu: Report a problem, My requests (badge)
 *   form      the report form (identified), with the type and impact chips
 *   list      My requests with six requests (Open, then All)
 *   empty     My requests of a reporter with no request
 *   expired   My requests when the identity token is refused (401)
 *   anonymous the form with no identity: the FAB opens the form directly
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
      const visit = async (path: string) => {
        const page = await (
          await browser.newContext({
            viewport: { width, height },
            colorScheme: scheme,
          })
        ).newPage();
        await page.goto(`http://localhost:${server.port}${path}`);
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
        return page;
      };
      const shoot = (page: Awaited<ReturnType<typeof visit>>, name: string) =>
        page.screenshot({ path: `${out}/${name}-${width}-${scheme}.png` });

      // Identified: the launcher badge, the form, the list.
      let page = await visit("/identified");
      await page.getByRole("button", { name: /Report a problem, 3/ }).waitFor();
      await shoot(page, "fab");
      await page.getByRole("button", { name: /Report a problem/ }).click();
      await page.getByRole("menuitem", { name: /My requests/ }).waitFor();
      await page.waitForTimeout(400);
      await shoot(page, "menu");
      await page.getByRole("menuitem", { name: /Report a problem/ }).click();
      await page.getByRole("dialog").waitFor();
      // The screenshot pane lazy-loads: wait for it, or the capture shows its loading state.
      await page
        .getByRole("button", { name: "Upload a file", exact: true })
        .waitFor({ state: "visible" });
      await page.waitForTimeout(500);
      await shoot(page, "form");
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await page.getByRole("button", { name: /Report a problem/ }).click();
      await page.getByRole("menuitem", { name: /My requests/ }).click();
      await page.getByText("The pay button does nothing").waitFor();
      await page.waitForTimeout(400);
      await shoot(page, "list");
      // A row under the pointer: the hover tint must span the whole row, chevron included.
      await page
        .getByRole("button", { name: /Open request: /i })
        .first()
        .hover();
      await page.waitForTimeout(300);
      await shoot(page, "list-hover");
      await page.getByRole("radio", { name: /^All/ }).click();
      await page.getByText("Add a dark mode to the store").waitFor();
      await page.waitForTimeout(300);
      await shoot(page, "list-all");
      await page.getByRole("radio", { name: /^Declined/ }).click();
      await page.getByText("Add a dark mode to the store").waitFor();
      await page.close();

      // No request yet.
      page = await visit("/identified-empty");
      await page.getByRole("button", { name: /Report a problem/ }).click();
      await page.getByRole("menuitem", { name: /My requests/ }).click();
      await page.getByText("No requests yet").waitFor();
      await page.waitForTimeout(300);
      await shoot(page, "empty");
      await page.close();

      // A refused token: the list says so, and offers no retry.
      page = await visit("/identified-expired");
      await page.getByRole("button", { name: /Report a problem/ }).click();
      await page.getByRole("menuitem", { name: /My requests/ }).click();
      await page.getByText("Your identity could not be confirmed").waitFor();
      await page.waitForTimeout(300);
      await shoot(page, "expired");
      await page.close();

      // No token: the FAB opens the form directly.
      page = await visit("/");
      await page.getByRole("button", { name: "Report a problem" }).click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(500);
      if ((await page.getByRole("tab").count()) !== 0) {
        failed = true;
        console.error("tabs shown without an identity token");
      }
      await shoot(page, "anonymous");
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.stop(true);
}
if (failed) process.exit(1);
console.log(`captures in ${out}`);
