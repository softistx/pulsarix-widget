import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  setDefaultTimeout,
  test,
} from "bun:test";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MESSAGES } from "../../../core/messages";

setDefaultTimeout(30_000);

// The editor needs a canvas and happy-dom cannot capture the screen: a stub capture and a stub
// editor hand the flow a screenshot file by a click on "Add", then "Capture this page", then "stub-shot".
// `mock.module` is process-wide and survives the file: keep the real modules to put them back.
const realCapture = { ...(await import("../../screenshot/model/capture")) };
const realEditor = {
  ...(await import("../../screenshot/components/editor-host")),
};
let shot = new File([new Uint8Array(100)], "x.png", { type: "image/png" });
function StubEditor({ onSave }: { onSave: (file: File) => void }) {
  return (
    <button type="button" onClick={() => onSave(shot)}>
      stub-shot
    </button>
  );
}
mock.module("../../screenshot/model/capture", () => ({
  ...realCapture,
  captureAvailable: () => true,
  captureWithHostHidden: async () => new Blob(["x"], { type: "image/png" }),
}));
mock.module("../../screenshot/components/editor-host", () => ({
  ...realEditor,
  EditorHost: StubEditor,
}));
/** Opens the one "Add" button's choices. */
const openAdd = async (user: ReturnType<typeof userEvent.setup>) => {
  const add = await screen.findByRole("button", { name: "Add" });
  if (add.getAttribute("aria-expanded") !== "true") await user.click(add);
};
const shoot = async (user: ReturnType<typeof userEvent.setup>) => {
  await openAdd(user);
  await user.click(
    await screen.findByRole("button", { name: "Capture this page" }),
  );
  await user.click(await screen.findByText("stub-shot"));
};
const { App } = await import("../../../app");
afterAll(() => {
  mock.module("../../screenshot/model/capture", () => realCapture);
  mock.module("../../screenshot/components/editor-host", () => realEditor);
});

interface Declared {
  role: string;
  name: string;
  type: string;
  size: number;
}
let declared: Declared[] = [];
let lastInput: Record<string, unknown> = {};
let configAttachments: boolean | undefined;
/** The tickets the API returns, by declared index; null drops one. */
let tickets: (index: number, file: Declared) => Record<string, unknown> | null;
let puts: FakeXHR[] = [];
let hold = false;
let configFails = false;

class FakeXHR {
  url = "";
  status = 0;
  responseText = "";
  upload = {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  onloadend?: () => void;
  open(_method: string, url: string) {
    this.url = url;
  }
  setRequestHeader() {}
  send() {
    puts.push(this);
    if (hold) return;
    setTimeout(() => {
      this.status = 200;
      this.responseText = "{}";
      this.onload?.();
    }, 0);
  }
  abort() {
    this.onabort?.();
  }
}

const realFetch = globalThis.fetch;
const realXhr = globalThis.XMLHttpRequest;
const realBitmap = globalThis.createImageBitmap;
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  declared = [];
  puts = [];
  hold = false;
  configFails = false;
  configAttachments = true;
  tickets = (index, file) => ({
    slot: `slot${index}`,
    role: file.role,
    ticket: `ticket${index}`,
    expiresAt: "2026-11-16T12:00:00Z",
  });
  shot = new File([new Uint8Array(100)], "x.png", { type: "image/png" });
  globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
  // @ts-expect-error: happy-dom has none, and a screenshot over 5 MB then cannot be re-encoded.
  globalThis.createImageBitmap = undefined;
  globalThis.fetch = mock(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      id: string;
      variables: { input?: { files?: Declared[] } };
    };
    if (body.id === "widgetConfig" && configFails)
      return new Response("{}", { status: 500 });
    if (body.id === "widgetConfig")
      return json({
        data: {
          widgetConfig: {
            projectName: "Acme",
            enabled: true,
            ...(configAttachments === undefined
              ? {}
              : { attachments: configAttachments }),
          },
        },
      });
    lastInput = (body.variables.input ?? {}) as Record<string, unknown>;
    declared = body.variables.input?.files ?? [];
    return json({
      data: {
        submitClientReport: {
          reportId: "r1",
          tracking: false,
          files: declared
            .map((file, index) => tickets(index, file))
            .filter(Boolean),
        },
      },
    });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
  globalThis.XMLHttpRequest = realXhr;
  globalThis.createImageBitmap = realBitmap;
});

function Host({ onSubmitted }: { onSubmitted: (detail: unknown) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <App
      messages={MESSAGES.en}
      locale="en"
      projectKey="pk_live_abc"
      apiBase="https://pulsarix.test"
      dark={false}
      open={open}
      launcher={false}
      position="bottom-right"
      onOpenChange={setOpen}
      onSubmitted={onSubmitted}
      onError={() => {}}
      minFillMs={0}
      retryDelayMs={1}
    />
  );
}

function setup() {
  const onSubmitted = mock((_: unknown) => {});
  render(<Host onSubmitted={onSubmitted} />);
  return { user: userEvent.setup({ applyAccept: false }), onSubmitted };
}

async function send(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("dialog");
  // Typed keystroke by keystroke is slow in happy-dom: a change event sets each value.
  fireEvent.change(screen.getByRole("textbox", { name: /Title/ }), {
    target: { value: "Checkout" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /What happened/ }), {
    target: { value: "Pay does nothing" },
  });
  await user.click(screen.getByRole("button", { name: MESSAGES.en.submit }));
}

const fileInput = () => document.querySelector('input[type="file"]');

describe("a widgetConfig without `attachments` (an older API)", () => {
  test("hides the controls and declares no files", async () => {
    configAttachments = undefined;
    const { user } = setup();
    await waitFor(() => expect(fileInput()).toBeNull());
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    await send(user);
    await screen.findByText(MESSAGES.en.done.noTracking);
    expect(declared).toEqual([]);
  });
});

describe("a failed widgetConfig read", () => {
  test("shows no controls, and never flashes them", async () => {
    configFails = true;
    const { user } = setup();
    await screen.findByRole("dialog");
    expect(fileInput()).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fileInput()).toBeNull();
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    await send(user);
    await screen.findByText(MESSAGES.en.done.noTracking);
    expect(declared).toEqual([]);
  });
});

describe("the screenshot upload path", () => {
  test("the Add disclosure toggles and closes after a choice, focus back on Add", async () => {
    const { user } = setup();
    const toggle = () => screen.getByRole("button", { name: "Add" });
    await screen.findByRole("button", { name: "Add" });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: "Upload a file" })).toBeNull();
    await user.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    await user.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    await user.click(toggle());
    await user.click(
      await screen.findByRole("button", { name: "Upload a file" }),
    );
    await waitFor(() =>
      expect(toggle().getAttribute("aria-expanded")).toBe("false"),
    );
    expect(document.activeElement === toggle()).toBe(true);
  });

  test("a screenshot is declared with role screenshot and its name", async () => {
    const { user, onSubmitted } = setup();
    await shoot(user);
    await send(user);
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(declared).toEqual([
      {
        role: "screenshot",
        name: "screenshot.png",
        type: "image/png",
        size: 100,
      },
    ]);
    expect(puts).toHaveLength(1);
    expect(onSubmitted).toHaveBeenCalledWith({
      reportId: "r1",
      files: [
        {
          name: "screenshot.png",
          role: "screenshot",
          type: "image/png",
          size: 100,
          uploaded: true,
        },
      ],
    });
  });

  test("a screenshot that cannot be fitted is left out and reported as not uploaded", async () => {
    shot = new File([new Uint8Array(6 * 1024 * 1024)], "x.png", {
      type: "image/png",
    });
    const { user, onSubmitted } = setup();
    await shoot(user);
    await send(user);
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(declared).toEqual([]);
    expect(puts).toHaveLength(0);
    expect(onSubmitted).toHaveBeenCalledWith({
      reportId: "r1",
      files: [
        {
          name: "screenshot.png",
          role: "screenshot",
          type: "image/png",
          size: 6 * 1024 * 1024,
          uploaded: false,
        },
      ],
    });
  });

  const expectUnknownScreenshot = async (
    run: Awaited<ReturnType<typeof pickScreenshot>>,
  ) => {
    await waitFor(() => expect(run.onSubmitted).toHaveBeenCalledTimes(1));
    expect(puts).toHaveLength(0);
    expect(run.onSubmitted).toHaveBeenCalledWith({
      reportId: "r1",
      files: [expect.objectContaining({ uploaded: false })],
    });
  };
  const pickScreenshot = async () => {
    const run = setup();
    await shoot(run.user);
    await send(run.user);
    return run;
  };

  test("a missing ticket gives unknown", async () => {
    tickets = () => null;
    await expectUnknownScreenshot(await pickScreenshot());
  });

  test("a file ticket given to a screenshot gives unknown", async () => {
    tickets = (index) => ({
      slot: `slot${index}`,
      role: "file",
      ticket: "t",
      expiresAt: "2026-11-16T12:00:00Z",
    });
    await expectUnknownScreenshot(await pickScreenshot());
  });

  test("a screenshot ticket given to a file gives unknown", async () => {
    tickets = (index) => ({
      slot: `slot${index}`,
      role: "screenshot",
      ticket: "t",
      expiresAt: "2026-11-16T12:00:00Z",
    });
    const { user, onSubmitted } = setup();
    await screen.findByRole("button", { name: "Add" });
    await user.upload(fileInput() as HTMLInputElement, [
      new File([new Uint8Array(100)], "a.png", { type: "image/png" }),
    ]);
    // The uploaded image opens in the editor right away: saving it keeps it a file.
    await user.click(await screen.findByText("stub-shot"));
    await send(user);
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(puts).toHaveLength(0);
    expect(onSubmitted).toHaveBeenCalledWith({
      reportId: "r1",
      files: [expect.objectContaining({ role: "file", uploaded: false })],
    });
  });
});

describe("closing while the files go up", () => {
  test("pulsarix:submit still fires once, with the file as not uploaded", async () => {
    hold = true;
    const { user, onSubmitted } = setup();
    await shoot(user);
    await send(user);
    await waitFor(() => expect(puts).toHaveLength(1));
    cleanup(); // the dialog closes: the flow unmounts and aborts the PUT
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(onSubmitted).toHaveBeenCalledWith({
      reportId: "r1",
      files: [expect.objectContaining({ role: "screenshot", uploaded: false })],
    });
  });

  test("closing only the dialog (its Cancel button) still emits one pulsarix:submit", async () => {
    hold = true;
    const { user, onSubmitted } = setup();
    await shoot(user);
    await send(user);
    await waitFor(() => expect(puts).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: MESSAGES.en.cancel }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(onSubmitted).toHaveBeenCalledWith({
      reportId: "r1",
      files: [expect.objectContaining({ role: "screenshot", uploaded: false })],
    });
  });
});

describe("the editor opens on capture and upload, and each capture keeps its page", () => {
  const here = `${location.origin}${location.pathname}`;
  const pageEntries = () =>
    ((lastInput.metadata ?? []) as { key: string; value: string }[]).filter(
      (m) => m.key.startsWith("capture-"),
    );

  test("a capture opens the editor at once, and its page is shown and sent", async () => {
    const { user, onSubmitted } = setup();
    await shoot(user);
    expect(
      await screen.findByText(`Captured on ${here}`, { exact: false }),
    ).toBeTruthy();
    await send(user);
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(lastInput.pageUrl).toBe(here);
    expect(pageEntries()).toEqual([{ key: "capture-1-page", value: here }]);
  });

  test("Edit reopens an attachment in the editor", async () => {
    const { user } = setup();
    await shoot(user);
    await user.click(
      await screen.findByRole("button", { name: "Edit capture 1" }),
    );
    expect(await screen.findByText("stub-shot")).toBeTruthy();
  });

  test("an uploaded image opens the editor, and Edit is offered on it", async () => {
    const { user } = setup();
    await screen.findByRole("button", { name: "Add" });
    await user.upload(fileInput() as HTMLInputElement, [
      new File([new Uint8Array(100)], "a.png", { type: "image/png" }),
    ]);
    expect(await screen.findByText("stub-shot")).toBeTruthy();
    await user.click(screen.getByText("stub-shot"));
    expect(await screen.findByRole("button", { name: /^Edit / })).toBeTruthy();
  });

  test("each capture's page goes in the metadata, one entry per capture", async () => {
    const { user, onSubmitted } = setup();
    await shoot(user);
    await shoot(user);
    await send(user);
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(pageEntries()).toEqual([
      { key: "capture-1-page", value: here },
      { key: "capture-2-page", value: here },
    ]);
  });

  test("three more captures fit beside the first, the next one is refused with the count notice", async () => {
    const { user } = setup();
    for (let n = 0; n < 4; n++) await shoot(user);
    await openAdd(user);
    await user.click(
      await screen.findByRole("button", { name: "Capture this page" }),
    );
    expect(
      await screen.findByText("A report takes 3 files at most."),
    ).toBeTruthy();
  });
});
