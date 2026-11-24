/**
 * Captures the edge-tab launcher in the host fixture, at 360 and 1440 px, light and dark:
 *   - at rest (peeking), on hover with its tooltip, with the dialog open (anonymous reporter);
 *   - the identified reporter's tab with its unread badge, and its menu;
 *   - the tab on the left edge, and after a drag.
 * It also checks the tab's size, that a drag never opens the dialog, and the keyboard move.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { serveFixture } from "./serve-fixture";

const out = process.argv[2] ?? "captures";
mkdirSync(out, { recursive: true });
const server = serveFixture(0);
const browser = await chromium.launch();
let failed = false;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed = true;
};

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
            hasTouch: false,
          })
        ).newPage();
        await page.goto(`http://localhost:${server.port}${path}`);
        await page.waitForFunction(() =>
          document
            .querySelector("pulsarix-widget")
            ?.shadowRoot?.querySelector("[data-launcher=tab]"),
        );
        await page.evaluate(
          (s) =>
            document.querySelector("pulsarix-widget")?.setAttribute("theme", s),
          scheme,
        );
        await page.waitForTimeout(300);
        return page;
      };
      const shoot = (page: Awaited<ReturnType<typeof visit>>, name: string) =>
        page.screenshot({ path: `${out}/${name}-${width}-${scheme}.png` });
      const tab = (page: Awaited<ReturnType<typeof visit>>) =>
        page.getByRole("button", {
          name: /^(Report a problem|Feedback and requests)/,
        });
      const inShadow = <T>(
        page: Awaited<ReturnType<typeof visit>>,
        fn: (root: ShadowRoot) => T,
      ) =>
        page.evaluate(
          `(${fn.toString()})(document.querySelector("pulsarix-widget").shadowRoot)`,
        ) as Promise<T>;

      // Anonymous: rest, hover with the tooltip, the dialog open.
      let page = await visit("/");
      const box = await tab(page).boundingBox();
      // Wide: 50 px wide, 6 px off screen at rest, 44 x 44 visible. Phone (<= 600 px): 24 x 44, no peek.
      const wide = width > 600;
      const tabW = wide ? 44 : 24;
      const visible = box
        ? Math.min(box.x + box.width, width) - Math.max(box.x, 0)
        : 0;
      check(
        !!box &&
          Math.round(box.width) === tabW + (wide ? 6 : 0) &&
          Math.round(visible) === tabW &&
          Math.round(box.height) === 44,
        `the tab shows ${tabW} x 44 of ${box?.width} x ${box?.height} at ${width} px (${visible} visible)`,
      );
      await page.mouse.move(2, 2);
      await shoot(page, "rest");
      await tab(page).hover();
      await page.waitForTimeout(600);
      await shoot(page, "hover");
      // Keyboard focus on the right-docked tab: the two-tone ring and the key hint.
      await page.mouse.move(2, 2);
      await page.keyboard.press("Shift");
      await tab(page).focus();
      await page.waitForTimeout(600);
      await shoot(page, "focus");
      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      );
      // A drag moves it and never opens the dialog.
      const before = await tab(page).boundingBox();
      if (before) {
        await page.mouse.move(before.x + 20, before.y + 20);
        await page.mouse.down();
        await page.mouse.move(before.x + 20, before.y - 120, { steps: 8 });
        await page.mouse.up();
      }
      const after = await tab(page).boundingBox();
      check(
        !!before && !!after && after.y < before.y - 100,
        "dragging moves the tab up",
      );
      check(
        (await page.getByRole("dialog").count()) === 0,
        "a drag does not open the dialog",
      );
      await tab(page).focus();
      await page.keyboard.press("Alt+ArrowDown");
      const keyed = await tab(page).boundingBox();
      check(
        !!after && !!keyed && keyed.y > after.y,
        "Alt+ArrowDown moves the tab down",
      );
      await page.reload();
      await page.waitForFunction(() =>
        document
          .querySelector("pulsarix-widget")
          ?.shadowRoot?.querySelector("[data-launcher=tab]"),
      );
      const restored = await tab(page).boundingBox();
      check(
        !!keyed && !!restored && Math.abs(restored.y - keyed.y) < 1,
        "the position is restored after a reload",
      );
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForFunction(() =>
        document
          .querySelector("pulsarix-widget")
          ?.shadowRoot?.querySelector("[data-launcher=tab]"),
      );
      await page.evaluate(
        (s) =>
          document.querySelector("pulsarix-widget")?.setAttribute("theme", s),
        scheme,
      );
      // A mouse press (pointerdown is cancelled for the drag) still leaves focus on the tab.
      const pressBox = await tab(page).boundingBox();
      if (pressBox) {
        await page.mouse.move(
          pressBox.x + pressBox.width / 2,
          pressBox.y + pressBox.height / 2,
        );
        await page.mouse.down();
        const pressed = await page.evaluate(
          () =>
            document
              .querySelector("pulsarix-widget")
              ?.shadowRoot?.activeElement?.getAttribute("aria-label") ?? null,
        );
        await page.mouse.up();
        check(
          !!pressed?.startsWith("Report a problem"),
          "a mouse press leaves focus on the tab",
        );
        await page.getByRole("dialog").waitFor();
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "detached" });
      }
      await tab(page).click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(500);
      await shoot(page, "dock");
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      const focused = await page.evaluate(
        () =>
          document
            .querySelector("pulsarix-widget")
            ?.shadowRoot?.activeElement?.getAttribute("aria-label") ?? null,
      );
      check(
        !!focused?.startsWith("Report a problem"),
        "Escape returns focus to the tab",
      );
      await page.close();

      // Identified: the unread badge, the menu; and the left edge.
      page = await visit("/identified");
      await page
        .getByRole("button", { name: /Feedback and requests, 3/ })
        .waitFor();
      await page.mouse.move(2, 2);
      await shoot(page, "identified");
      await tab(page).click();
      await page.getByRole("menuitem", { name: /My requests/ }).waitFor();
      await page.waitForTimeout(300);
      await shoot(page, "menu");
      // What the library draws: the bubble's ring, and the duotone layer of the menu icons.
      const probe = await inShadow(page, (root) => {
        const bubble = root.querySelector(
          '[data-slot="count-badge"] > [aria-hidden="true"]',
        );
        const icon = root.querySelector('svg[data-slot="icon"]');
        return {
          bubble: bubble ? getComputedStyle(bubble).boxShadow : null,
          secondary: icon
            ? getComputedStyle(icon).getPropertyValue("--fa-secondary-opacity")
            : null,
        };
      });
      console.log("probe", JSON.stringify(probe));
      // Keyboard focus on a menu row (opened with Enter, first row focused).
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await page.keyboard.press("Shift");
      await tab(page).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("menuitem", { name: /My requests/ }).waitFor();
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(300);
      await shoot(page, "menurow");
      await page.evaluate(() =>
        document
          .querySelector("pulsarix-widget")
          ?.setAttribute("launcher-side", "left"),
      );
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      await page.mouse.move(width - 2, height - 2);
      await shoot(page, "left");
      await page.close();

      // The tab on a dark host page, with the light and the dark widget (the same scheme loop).
      page = await visit("/dark");
      await page.mouse.move(2, 2);
      await shoot(page, "darkhost");
      await page.keyboard.press("Shift");
      await tab(page).focus();
      await page.waitForTimeout(600);
      await shoot(page, "darkhost-focus");
      await page.close();
      page = await visit("/dark-identified");
      await page.mouse.move(2, 2);
      await shoot(page, "darkhost-identified");
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.stop(true);
}
process.exit(failed ? 1 : 0);
