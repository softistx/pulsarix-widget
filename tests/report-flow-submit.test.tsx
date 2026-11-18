import {
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
import { MESSAGES } from "../src/messages";

setDefaultTimeout(30_000);

// The pane's editor needs a canvas: a stub hands the flow a screenshot file by a click.
let shot = new File([new Uint8Array(100)], "x.png", { type: "image/png" });
mock.module("../src/screenshot/pane", () => ({
  ScreenshotPane: ({ onImage }: { onImage: (file: File) => void }) => (
    <button type="button" onClick={() => onImage(shot)}>
      stub-shot
    </button>
  ),
}));
const { App } = await import("../src/app");

interface Declared {
  role: string;
  name: string;
  type: string;
  size: number;
}
let declared: Declared[] = [];
let configAttachments: boolean | undefined;
/** The tickets the API returns, by declared index; null drops one. */
let tickets: (index: number, file: Declared) => Record<string, unknown> | null;
let puts: FakeXHR[] = [];
let hold = false;

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

function setup() {
  const onSubmitted = mock((_: unknown) => {});
  render(
    <App
      messages={MESSAGES.en}
      locale="en"
      projectKey="pk_live_abc"
      apiBase="https://pulsarix.test"
      dark={false}
      open
      launcher={false}
      position="bottom-right"
      onOpenChange={() => {}}
      onSubmitted={onSubmitted}
      onError={() => {}}
      minFillMs={0}
      retryDelayMs={1}
    />,
  );
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
    expect(screen.queryByText("stub-shot")).toBeNull();
    await send(user);
    await screen.findByText(MESSAGES.en.done.noTracking);
    expect(declared).toEqual([]);
  });
});

describe("the screenshot upload path", () => {
  test("a screenshot is declared with role screenshot and its name", async () => {
    const { user, onSubmitted } = setup();
    await user.click(await screen.findByText("stub-shot"));
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
    await user.click(await screen.findByText("stub-shot"));
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

  test("a missing ticket gives unknown, and a ticket of another role too", async () => {
    tickets = () => null;
    const first = setup();
    await first.user.click(await screen.findByText("stub-shot"));
    await send(first.user);
    await waitFor(() => expect(first.onSubmitted).toHaveBeenCalledTimes(1));
    expect(puts).toHaveLength(0);
    expect(first.onSubmitted).toHaveBeenCalledWith({
      reportId: "r1",
      files: [expect.objectContaining({ role: "screenshot", uploaded: false })],
    });
    cleanup();
    tickets = (index) => ({
      slot: `slot${index}`,
      role: "file",
      ticket: "t",
      expiresAt: "2026-11-16T12:00:00Z",
    });
    const second = setup();
    await second.user.click(await screen.findByText("stub-shot"));
    await send(second.user);
    await waitFor(() => expect(second.onSubmitted).toHaveBeenCalledTimes(1));
    expect(puts).toHaveLength(0);
    expect(second.onSubmitted).toHaveBeenCalledWith({
      reportId: "r1",
      files: [expect.objectContaining({ role: "screenshot", uploaded: false })],
    });
  });
});

describe("closing while the files go up", () => {
  test("pulsarix:submit still fires once, with the file as not uploaded", async () => {
    hold = true;
    const { user, onSubmitted } = setup();
    await user.click(await screen.findByText("stub-shot"));
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
});
