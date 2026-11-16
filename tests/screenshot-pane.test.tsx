import { afterEach, describe, expect, mock, test } from "bun:test";
import { CaptureScreenError } from "@softistx/material/capture";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MESSAGES } from "../src/messages";
import { failureOf } from "../src/screenshot/capture";
import { ScreenshotPane } from "../src/screenshot/pane";

afterEach(cleanup);
const en = MESSAGES.en;

describe("ScreenshotPane without screen capture (happy-dom has no getDisplayMedia)", () => {
  test("offers the upload alone, and no mask option", () => {
    render(<ScreenshotPane messages={en} image={null} onImage={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Upload an image" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Add a screenshot" }),
    ).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  test("refuses a file that is not a PNG, JPEG or WebP", async () => {
    const onImage = mock(() => {});
    const { container } = render(
      <ScreenshotPane messages={en} image={null} onImage={onImage} />,
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    // `applyAccept: false`: the input would otherwise drop the file before the pane sees it.
    await userEvent
      .setup({ applyAccept: false })
      .upload(input, new File(["x"], "notes.txt", { type: "text/plain" }));
    await waitFor(() =>
      expect(screen.getByText(en.screenshot.errors.type)).toBeTruthy(),
    );
    expect(onImage).not.toHaveBeenCalled();
  });

  test("a kept image shows Retake and Remove; Remove hands null back", async () => {
    const onImage = mock((_image: File | null) => {});
    render(
      <ScreenshotPane
        messages={en}
        image={new File(["x"], "screenshot.png", { type: "image/png" })}
        onImage={onImage}
      />,
    );
    expect(screen.getByRole("button", { name: "Retake" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onImage).toHaveBeenCalledWith(null);
  });
});

test("capture errors map to the pane's messages", () => {
  expect(failureOf(new CaptureScreenError("denied", "x"))).toBe("denied");
  expect(failureOf(new CaptureScreenError("unsupported", "x"))).toBe(
    "unavailable",
  );
  expect(failureOf(new CaptureScreenError("mask-unavailable", "x"))).toBe(
    "maskUnavailable",
  );
  expect(failureOf(new CaptureScreenError("failed", "x"))).toBe("failed");
  expect(failureOf(new Error("boom"))).toBe("failed");
});
