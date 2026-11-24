import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "https://shop.example.com/cart" });
// React's `act` warns without this flag.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// The component specs mount `App` with an https base, so InlineIconSprites fetches the icon sheet
// through each spec's own fetch mock; a mock that does not serve it only costs a console warning,
// which is not what these specs check.
const warn = console.warn;
console.warn = (...args: unknown[]) => {
  if (String(args[0]).startsWith("InlineIconSprites: could not load")) return;
  warn(...args);
};
