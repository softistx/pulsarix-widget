import { describe, expect, test } from "bun:test";
import { iconBase } from "./icons";

describe("iconBase", () => {
  test("an https host gets the widget's icon folder", () => {
    expect(iconBase("https://pulsarix.example")).toBe(
      "https://pulsarix.example/widget/v1/icons/",
    );
    expect(iconBase("https://pulsarix.example/")).toBe(
      "https://pulsarix.example/widget/v1/icons/",
    );
  });

  test("http is accepted on localhost only", () => {
    expect(iconBase("http://localhost:4177")).toBe(
      "http://localhost:4177/widget/v1/icons/",
    );
    expect(iconBase("http://192.168.1.2")).toBeNull();
    expect(iconBase("http://127.0.0.1:3000")).toBeNull();
  });

  test("a path material refuses gives no base", () => {
    expect(iconBase("https://pulsarix.example/a%20b")).toBeNull();
    expect(iconBase("https://pulsarix.example/a+b")).toBeNull();
  });

  test("no apiBase gives no base", () => {
    expect(iconBase(null)).toBeNull();
    expect(iconBase(undefined)).toBeNull();
  });
});
