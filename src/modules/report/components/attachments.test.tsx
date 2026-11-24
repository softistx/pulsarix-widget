import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createRef } from "react";
import { MESSAGES } from "../../../core/messages";
import type { Entry } from "../../files/hooks/use-attachments";
import { AttachmentsControl } from "./attachments";

afterEach(cleanup);

const png = (name: string) =>
  new File([new Uint8Array(10)], name, { type: "image/png" });

function show(items: Entry[], canCapture = true) {
  render(
    <AttachmentsControl
      messages={MESSAGES.en}
      locale="en"
      region={createRef<HTMLDivElement>()}
      items={items}
      locked={false}
      overTotal={false}
      canCapture={canCapture}
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

describe("the two sections", () => {
  test("captures sit under Screenshot and uploads under Attachments", () => {
    show([
      { id: "a", file: png("one.png"), pageUrl: "https://a.test/x" },
      { id: "b", file: png("photo.png") },
    ]);
    const shot = screen.getByTestId("capture-section");
    const files = screen.getByRole("group", { name: MESSAGES.en.files.label });
    expect(shot?.textContent).toContain("Captured on https://a.test/x");
    expect(shot?.textContent).not.toContain("photo.png");
    expect(files.textContent).toContain("photo.png");
    expect(files.textContent).not.toContain("one.png");
  });

  test("without capture support and no capture, only Attachments is shown", () => {
    show([], false);
    expect(screen.queryByText(MESSAGES.en.screenshot.sectionTitle)).toBeNull();
    expect(
      screen.getByRole("group", { name: MESSAGES.en.files.label }),
    ).toBeTruthy();
  });
});

describe("a refused file", () => {
  test("is brought into view after a refused drop", async () => {
    const scroll = mock(() => {});
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      const refused = { file: png("big.png"), refusal: "Too big" };
      const view = (items: Entry[]) => (
        <AttachmentsControl
          messages={MESSAGES.en}
          locale="en"
          region={createRef<HTMLDivElement>()}
          items={items}
          locked={false}
          overTotal={false}
          canCapture={false}
          busy={false}
          notice={null}
          maskText={false}
          onMaskText={() => {}}
          onCapture={() => {}}
          onDrop={() => {}}
          onRemove={() => {}}
          onEdit={() => {}}
        />
      );
      const { rerender } = render(view([]));
      const input = screen.getByTestId("attachments-input") as HTMLInputElement;
      const bad = new File([new Uint8Array(1)], "x.exe", { type: "x/y" });
      Object.defineProperty(input, "files", {
        value: [bad],
        configurable: true,
      });
      fireEvent.change(input);
      rerender(view([{ id: "r", ...refused }]));
      await waitFor(() => expect(scroll).toHaveBeenCalled());
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
