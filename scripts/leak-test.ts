/**
 * The host-fixture leak test (slice W0 acceptance), run in Chromium:
 *   - nothing from the host page's styles reaches the widget, and
 *   - nothing from the widget's styles reaches the host page.
 * A browser test: local only, never in CI (see "Browser tests" in the owner's rules).
 */
import { chromium, type Page } from "playwright-core";
import { serveFixture } from "./serve-fixture";

const PROPS = [
  "color",
  "backgroundColor",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textTransform",
  "textDecorationLine",
  "borderTopWidth",
  "borderTopStyle",
  "borderRadius",
  "marginTop",
  "marginBottom",
  "paddingLeft",
  "listStyleType",
  "display",
  "boxSizing",
  "colorScheme",
  "width",
  "height",
];

const PROBES = [
  "html",
  "body",
  "#probe-h1",
  "#probe-p",
  "#probe-a",
  "#probe-ul",
  "#probe-button",
  "#probe-input",
];

function hostSnapshot(page: Page) {
  return page.evaluate(
    ({ probes, props }) => {
      const styles: Record<string, Record<string, string>> = {};
      for (const selector of probes) {
        const cs = getComputedStyle(
          document.querySelector(selector) as Element,
        ) as unknown as Record<string, string>;
        styles[selector] = Object.fromEntries(
          props.map((p) => [p, cs[p] as string]),
        );
      }
      const root = getComputedStyle(document.documentElement);
      return {
        styles,
        rootTokens: [
          "--primary",
          "--background",
          "--radius",
          "--foreground",
        ].map((t) => root.getPropertyValue(t)),
        styleSheets: document.styleSheets.length,
        adoptedStyleSheets: document.adoptedStyleSheets.length,
        headHtml: document.head.innerHTML,
        bodyChildTags: [...document.body.children]
          .map((c) => c.tagName.toLowerCase())
          .filter((t) => t !== "script"),
        globals: Object.keys(window).sort(),
      };
    },
    { probes: PROBES, props: PROPS },
  );
}

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${message}`);
  if (!ok) failures.push(message);
};

const server = serveFixture(0);
const base = `http://localhost:${server.port}`;
const browser = await chromium.launch();
try {
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${base}/baseline`);
  const baseline = await hostSnapshot(page);

  await page.goto(`${base}/`);
  await page.waitForFunction(() =>
    document
      .querySelector("pulsarix-widget")
      ?.shadowRoot?.querySelector("button"),
  );
  const closed = await hostSnapshot(page);

  // Out: the widget leaves the host page as it was.
  check(
    JSON.stringify(closed.styles) === JSON.stringify(baseline.styles),
    "host computed styles unchanged by the widget (closed)",
  );
  check(
    closed.styleSheets === baseline.styleSheets,
    "no stylesheet added to the document",
  );
  check(
    closed.adoptedStyleSheets === 0,
    "no adopted stylesheet on the document",
  );
  check(
    closed.headHtml === baseline.headHtml,
    "document head untouched (no style or link element)",
  );
  check(
    closed.rootTokens.every((t) => t.trim() === ""),
    "no theme token declared on the host's :root",
  );
  const newGlobals = closed.globals.filter(
    (g) => !baseline.globals.includes(g),
  );
  check(
    newGlobals.length === 1 && newGlobals[0] === "PulsarixWidget",
    `only global added: ${newGlobals.join(",") || "(none)"}`,
  );

  // In: the host's hostile rules do not reach the widget.
  const inner = await page.evaluate(() => {
    const host = document.querySelector("pulsarix-widget") as HTMLElement;
    const button = host.shadowRoot?.querySelector("button") as HTMLElement;
    const cs = getComputedStyle(button);
    const hostCs = getComputedStyle(host);
    return {
      bg: cs.backgroundColor,
      color: cs.color,
      radius: cs.borderTopLeftRadius,
      borderStyle: cs.borderTopStyle,
      fontStyle: cs.fontStyle,
      fontSize: cs.fontSize,
      family: cs.fontFamily,
      letterSpacing: cs.letterSpacing,
      transform: cs.textTransform,
      lineHeight: cs.lineHeight,
      hostScheme: hostCs.colorScheme,
      hostFontSize: hostCs.fontSize,
      hostLetter: hostCs.letterSpacing,
      hostTransform: hostCs.textTransform,
      htmlFontSize: getComputedStyle(document.documentElement).fontSize,
    };
  });
  check(
    inner.bg !== "rgb(255, 0, 0)" && inner.color !== "rgb(0, 255, 0)",
    `button keeps its own colours (${inner.bg} on ${inner.color})`,
  );
  check(
    inner.radius !== "0px" && inner.borderStyle !== "dashed",
    `button keeps its radius and border (${inner.radius}, ${inner.borderStyle})`,
  );
  check(
    inner.fontStyle === "normal" && inner.fontSize !== "30px",
    `button font not forced by the host (${inner.fontStyle} ${inner.fontSize})`,
  );
  check(
    inner.letterSpacing === "normal" && inner.transform === "none",
    "text-transform and letter-spacing are not inherited",
  );
  check(
    inner.hostScheme === "light",
    `color-scheme reset on the host element (page asks dark, widget ${inner.hostScheme})`,
  );
  check(
    inner.htmlFontSize === "40px" && inner.fontSize !== "",
    "page root font size is 40px",
  );

  // The root font size: the widget is sized in px, so a 40px html does not scale it.
  const sizes = await page.evaluate(() => {
    const button = document
      .querySelector("pulsarix-widget")
      ?.shadowRoot?.querySelector("button") as HTMLElement;
    const r = button.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  check(
    sizes.h < 80 && sizes.h > 20,
    `button height ${sizes.h.toFixed(0)}px is not scaled by the page's 40px root`,
  );

  // Open: the dialog portals inside the shadow root, still isolated.
  await page.evaluate(() => window.PulsarixWidget.open());
  await page.waitForFunction(() =>
    document
      .querySelector("pulsarix-widget")
      ?.shadowRoot?.querySelector('[role="dialog"]'),
  );
  await page.waitForTimeout(500);
  const open = await hostSnapshot(page);
  const dialog = await page.evaluate(() => {
    const host = document.querySelector("pulsarix-widget") as HTMLElement;
    const dlg = host.shadowRoot?.querySelector(
      '[role="dialog"]',
    ) as HTMLElement;
    const cs = getComputedStyle(dlg);
    return {
      inShadow: !!dlg,
      inBody: document.querySelectorAll('[role="dialog"]').length,
      bg: cs.backgroundColor,
      border: cs.borderTopColor,
      radius: cs.borderTopLeftRadius,
      primary: getComputedStyle(
        host.shadowRoot?.querySelector(".pulsarix-root") as Element,
      ).getPropertyValue("--primary"),
    };
  });
  check(
    dialog.inShadow && dialog.inBody === 0,
    "dialog is inside the shadow root, none in document.body",
  );
  check(
    dialog.bg !== "rgb(255, 255, 0)" && dialog.border !== "rgb(255, 0, 0)",
    `dialog not painted by host rules (${dialog.bg}, ${dialog.border})`,
  );
  check(
    dialog.primary.trim() !== "",
    `theme seed reaches the dialog scope (--primary ${dialog.primary.trim().slice(0, 28)})`,
  );
  check(
    JSON.stringify(open.styles) === JSON.stringify(baseline.styles),
    "host computed styles unchanged by the widget (open)",
  );
  // A modal makes the page inert: its scroll lock adds a transient style element and focus
  // guards to the document, and both go away on close.
  await page.evaluate(() => window.PulsarixWidget.close());
  await page.waitForFunction(
    () =>
      !document
        .querySelector("pulsarix-widget")
        ?.shadowRoot?.querySelector('[role="dialog"]'),
  );
  await page.waitForTimeout(500);
  const after = await hostSnapshot(page);
  check(
    after.headHtml === baseline.headHtml &&
      after.styleSheets === baseline.styleSheets,
    "document head and stylesheets back to the baseline after close",
  );
  check(
    JSON.stringify(after.bodyChildTags) ===
      JSON.stringify([...baseline.bodyChildTags, "pulsarix-widget"]),
    `body children after close: ${after.bodyChildTags.join(",")}`,
  );
  check(
    JSON.stringify(after.styles) === JSON.stringify(baseline.styles),
    "host computed styles unchanged after close",
  );
  check(
    errors.length === 0,
    `no page errors${errors.length ? `: ${errors[0]}` : ""}`,
  );
} finally {
  await browser.close();
  server.stop(true);
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nleak test: all checks passed");
