/**
 * Measures the contrast of the form's small muted texts (hints, caption, privacy line, header
 * lead) against what they sit on, in light and dark, at 360 and 1440: WCAG 2.2 AA asks 4.5:1.
 * Colours are resolved through a canvas, so `color-mix` and `oklch` tokens read as sRGB.
 * A browser test: local only, never in CI.
 */
import { chromium } from "playwright-core";
import { chooseFiles, openWidget, png } from "./files-test";
import { serveFixture } from "./serve-fixture";

const server = serveFixture(0);
const base = `http://localhost:${server.port}`;
const browser = await chromium.launch();
const failures: string[] = [];

const measure = () => {
  const host = document.querySelector("pulsarix-widget");
  const root = host?.shadowRoot;
  if (!root) return [];
  const ctx = document.createElement("canvas").getContext("2d", {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D;
  const rgba = (css: string): [number, number, number, number] => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [
      d[0] as number,
      d[1] as number,
      d[2] as number,
      (d[3] as number) / 255,
    ];
  };
  const over = (top: number[], bottom: number[]) => {
    const a = top[3] as number;
    return [0, 1, 2, 3].map((i) =>
      i === 3 ? 1 : (top[i] as number) * a + (bottom[i] as number) * (1 - a),
    );
  };
  const lum = (c: number[]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return (
      0.2126 * f(c[0] as number) +
      0.7152 * f(c[1] as number) +
      0.0722 * f(c[2] as number)
    );
  };
  const scheme = matchMedia("(prefers-color-scheme: dark)").matches;
  const out: { text: string; ratio: number; size: string }[] = [];
  const seen = new Set<Element>();
  for (const el of root.querySelectorAll("p, span, label")) {
    if (seen.has(el) || !el.textContent?.trim() || el.children.length > 1)
      continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || (el as HTMLElement).offsetParent === null)
      continue;
    const size = Number.parseFloat(cs.fontSize);
    if (size > 15) continue; // only the small texts
    seen.add(el);
    let bg = scheme ? [0, 0, 0, 1] : [255, 255, 255, 1];
    const chain: Element[] = [];
    for (
      let n: Element | null = el;
      n;
      n = n.parentElement ?? (n.getRootNode() as ShadowRoot).host ?? null
    )
      chain.push(n);
    for (const n of chain.reverse()) {
      const b = rgba(getComputedStyle(n).backgroundColor);
      if (b[3] > 0) bg = over(b, bg);
    }
    const fg = over(rgba(cs.color), bg);
    const [l1, l2] = [lum(fg), lum(bg)];
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    out.push({
      text: el.textContent.trim().slice(0, 40),
      ratio: Math.round(ratio * 100) / 100,
      size: cs.fontSize,
    });
  }
  return out;
};

try {
  for (const width of [1440, 360]) {
    for (const scheme of ["light", "dark"] as const) {
      const { page, context } = await openWidget(browser, `${base}/`, {
        width,
        scheme,
      });
      await chooseFiles(page, png("shot.png"));
      await page.waitForTimeout(300);
      const rows = await page.evaluate(measure);
      for (const r of rows) {
        const ok = r.ratio >= 4.5;
        console.log(
          `${ok ? "PASS" : "FAIL"}  ${width} ${scheme} ${r.ratio}:1 ${r.size} "${r.text}"`,
        );
        if (!ok) failures.push(`${width} ${scheme} ${r.text}`);
      }
      if (!rows.length) failures.push(`${width} ${scheme}: nothing measured`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}
if (failures.length) {
  console.error(`\n${failures.length} failed`);
  process.exit(1);
}
console.log("\ncontrast test: all checks passed");
