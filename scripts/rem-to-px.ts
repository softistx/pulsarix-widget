/**
 * `rem` follows the HOST page's root font size, which no stylesheet inside a shadow
 * root can reset. The widget's CSS is therefore written in `px` at the browser
 * default (1rem = 16px): the page's `html { font-size }` cannot resize the widget
 * (plan section 10: the root font size is reset). Media queries use the initial
 * 16px in every browser, so converting them changes nothing.
 *
 * Only declarations and at-rule preludes are converted: a selector holds class names
 * such as `.gap-\[var\(--g\,0\.5rem\)\]` that must keep their spelling.
 */
const REM = /(?<![\\\w.])(-?\d*\.?\d+)rem\b/g;
const convert = (text: string) =>
  text.replace(
    REM,
    (_, n: string) => `${+(Number.parseFloat(n) * 16).toFixed(4)}px`,
  );

export function remToPx(css: string): string {
  let out = "";
  let last = 0;
  for (const match of css.matchAll(/([^{};]*)([{};])/g)) {
    const [whole, text, delimiter] = match as unknown as [
      string,
      string,
      string,
    ];
    const isSelector = delimiter === "{" && !text.trimStart().startsWith("@");
    out += (isSelector ? text : convert(text)) + delimiter;
    last = (match.index ?? 0) + whole.length;
  }
  return out + convert(css.slice(last));
}
