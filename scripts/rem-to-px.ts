/**
 * `rem` follows the HOST page's root font size, which no stylesheet inside a shadow
 * root can reset. The widget's CSS is therefore written in `px` at the browser
 * default (1rem = 16px): the page's `html { font-size }` cannot resize the widget
 * (plan section 10: the root font size is reset). Media queries use the initial
 * 16px in every browser, so converting them changes nothing.
 */
export function remToPx(css: string): string {
  return css.replace(
    /(-?\d*\.?\d+)rem\b/g,
    (_, n: string) => `${+(Number.parseFloat(n) * 16).toFixed(4)}px`,
  );
}
