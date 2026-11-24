import { afterEach, describe, expect, mock, test } from "bun:test";
import { Dialog } from "@softistx/material/embed";
import { cleanup, render, screen } from "@testing-library/react";
import { MESSAGES } from "../../../core/messages";
import { FormFooter } from "./form-frame";

afterEach(cleanup);
const m = MESSAGES.en;

const footer = (submitting: boolean, blocked = false) =>
  render(
    <Dialog open onOpenChange={() => {}}>
      <FormFooter
        messages={m}
        onClose={mock(() => {})}
        submitting={submitting}
        blocked={blocked}
      />
    </Dialog>,
  );

describe("FormFooter", () => {
  test("Send reads Send when idle and stays enabled", () => {
    footer(false);
    const send = screen.getByRole("button", { name: m.submit });
    expect(send.hasAttribute("disabled")).toBe(false);
    expect(send.getAttribute("aria-busy")).not.toBe("true");
  });

  test("while sending Send keeps its label and stays focusable (aria-busy, not disabled)", () => {
    footer(true);
    const send = screen.getByRole("button", { name: m.submit });
    expect(send.textContent).toBe(m.submit);
    expect(send.hasAttribute("disabled")).toBe(false);
    expect(send.getAttribute("aria-busy")).toBe("true");
  });

  test("a blocked form disables Send", () => {
    footer(false, true);
    expect(
      screen.getByRole("button", { name: m.submit }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
