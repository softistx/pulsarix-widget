import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { App } from "./app";
import type { AppProps } from "./app-props";

/** `App` with its own open state, starting closed: the FAB's menu is how a test reaches a view. */
export function TestHost(props: Omit<AppProps, "open"> & { open?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <App
      {...props}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        props.onOpenChange(next);
      }}
    />
  );
}

/** FAB, then the "My requests" menu item (an identified reporter). */
export async function openRequests() {
  await userEvent.click(
    await screen.findByRole("button", {
      name: /^(Report a problem|Feedback and requests)/,
    }),
  );
  await userEvent.click(
    await screen.findByRole("menuitem", { name: /My requests/ }),
  );
}
