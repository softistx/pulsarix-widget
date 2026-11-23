import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { MESSAGES } from "../../../core/messages";
import type { Entry } from "../../files/hooks/use-attachments";
import { AttachmentsControl } from "./attachments";

afterEach(cleanup);

const png = (name: string) =>
  new File([new Uint8Array(10)], name, { type: "image/png" });

function show(items: Entry[]) {
  render(
    <AttachmentsControl
      messages={MESSAGES.en}
      locale="en"
      region={createRef<HTMLDivElement>()}
      items={items}
      locked={false}
      overTotal={false}
      canCapture
      busy={false}
      notice={null}
      maskText={false}
      onMaskText={() => {}}
      onCapture={() => {}}
      onDrop={() => {}}
      onRemove={() => {}}
      onEdit={() => {}}
    />,
  );
}

describe("the names of the edit buttons", () => {
  test("a capture is named by its place among the captures, an upload by its file", () => {
    show([
      { id: "a", file: png("one.png"), pageUrl: "https://a.test/x" },
      { id: "b", file: png("photo.png") },
      { id: "c", file: png("two.png"), pageUrl: "https://a.test/y" },
    ]);
    expect(screen.getByRole("button", { name: "Edit capture 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit capture 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit photo.png" })).toBeTruthy();
  });

  test("a capture that carries a refusal keeps its caption but has no Edit", () => {
    show([
      {
        id: "a",
        file: png("one.png"),
        pageUrl: "https://a.test/x",
        refusal: "Too big",
      },
    ]);
    expect(screen.getByText("Captured on https://a.test/x")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
  });
});
