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
    expect(send.getAttribute("aria-busy")).toBe("false");
  });

  test("while sending the label reads Sending... (never blank) and the button is disabled", () => {
    footer(true);
    const send = screen.getByRole("button", { name: m.submitting });
    expect(send.textContent).toBe(m.submitting);
    expect(send.hasAttribute("disabled")).toBe(true);
    expect(send.getAttribute("aria-busy")).toBe("true");
  });

  test("a blocked form disables Send", () => {
    footer(false, true);
    expect(
      screen.getByRole("button", { name: m.submit }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
