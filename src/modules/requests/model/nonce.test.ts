import { afterEach, describe, expect, test } from "bun:test";

// The module caches its answer, so each case imports a fresh copy.
let n = 0;
const fresh = async () =>
  (await import(`./nonce?case=${++n}`)) as {
    pageNonce: () => string | undefined;
  };

const add = (tag: "style" | "script", nonce: string) => {
  const el = document.createElement(tag);
  // Browsers hide the attribute once parsed and keep the `nonce` property; mirror both.
  el.setAttribute("nonce", nonce);
  Object.defineProperty(el, "nonce", { value: nonce });
  document.head.append(el);
};

afterEach(() => {
  document.head.replaceChildren();
});

describe("pageNonce", () => {
  test("reads the nonce of a style element", async () => {
    add("style", "abc");
    expect((await fresh()).pageNonce()).toBe("abc");
  });

  test("reads the nonce of a script element when no style has one", async () => {
    add("script", "xyz");
    expect((await fresh()).pageNonce()).toBe("xyz");
  });

  test("is undefined when the page carries none (the meta fallback is the provider's)", async () => {
    const meta = document.createElement("meta");
    meta.setAttribute("property", "csp-nonce");
    meta.setAttribute("content", "from-meta");
    document.head.append(meta);
    expect((await fresh()).pageNonce()).toBeUndefined();
  });

  test("keeps its first answer", async () => {
    add("style", "first");
    const { pageNonce } = await fresh();
    expect(pageNonce()).toBe("first");
    document.head.replaceChildren();
    add("style", "second");
    expect(pageNonce()).toBe("first");
  });
});
