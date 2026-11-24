import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

// An uploaded image opens the editor, which needs a canvas: a stub that cancels at once keeps the
// file as it was chosen, so these specs stay on the attachment list. `mock.module` is process-wide.
const realEditor = {
  ...(await import("../../screenshot/components/editor-host")),
};
function CancelAtOnce({ onCancel }: { onCancel: () => void }) {
  useEffect(() => onCancel(), [onCancel]);
  return null;
}
mock.module("../../screenshot/components/editor-host", () => ({
  ...realEditor,
  EditorHost: CancelAtOnce,
}));
const { App } = await import("../../../app");

import type { Locale } from "../../../config";
import { MESSAGES } from "../../../core/messages";

interface Declared {
  role: string;
  name: string;
  type: string;
  size: number;
}
let declared: Declared[] = [];
let configAttachments: boolean | undefined;
let puts: FakeXHR[] = [];
/** What a PUT answers: by attempt, the status and the API's error code. */
let answer: (
  xhr: FakeXHR,
  attempt: number,
) => { status: number; code?: string };
const attempts = new Map<string, number>();

class FakeXHR {
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  responseText = "";
  withCredentials = false;
  upload: { onprogress?: (e: ProgressEvent) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
  send(body: unknown) {
    this.body = body;
    puts.push(this);
    const attempt = (attempts.get(this.url) ?? 0) + 1;
    attempts.set(this.url, attempt);
    setTimeout(() => {
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 50,
        total: 100,
      } as ProgressEvent);
      const reply = answer(this, attempt);
      if (reply.status === 0) return this.onerror?.();
      this.status = reply.status;
      this.responseText = JSON.stringify(
        reply.status === 200
          ? { slot: "s", state: "received" }
          : { errors: [{ extensions: { code: reply.code ?? "" } }] },
      );
      this.onload?.();
    }, 0);
  }
  abort() {
    this.onabort?.();
  }
}

const realFetch = globalThis.fetch;
const realXhr = globalThis.XMLHttpRequest;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  declared = [];
  puts = [];
  attempts.clear();
  configAttachments = true;
  answer = () => ({ status: 200 });
  globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
  globalThis.fetch = mock(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      id: string;
      variables: { input?: { files?: Declared[] } };
    };
    if (body.id === "widgetConfig")
      return json({
        data: {
          widgetConfig: {
            projectName: "Acme Store",
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
          files: declared.map((file, index) => ({
            slot: `slot${index}`,
            role: file.role,
            ticket: `ticket${index}`,
            expiresAt: "2026-11-16T12:00:00Z",
          })),
        },
      },
    });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
  globalThis.XMLHttpRequest = realXhr;
});

function setup(options: { locale?: Locale; attachments?: boolean } = {}) {
  const locale = options.locale ?? "en";
  const onSubmitted = mock((_: unknown) => {});
  render(
    <App
      messages={MESSAGES[locale]}
      locale={locale}
      projectKey="pk_live_abc"
      apiBase="https://pulsarix.test"
      dark={false}
      open
      launcher={false}
      attachments={options.attachments}
      onOpenChange={() => {}}
      onSubmitted={onSubmitted}
      onError={() => {}}
      minFillMs={0}
      retryDelayMs={1}
    />,
  );
  // `applyAccept: false`: the rules are checked by the widget, which words each refusal.
  return { user: userEvent.setup({ applyAccept: false }), onSubmitted };
}

const file = (name: string, type: string, bytes = 100) =>
  new File([new Uint8Array(bytes)], name, { type });
const input = () =>
  document.querySelector('input[type="file"]') as HTMLInputElement;

async function fillAndSend(
  user: ReturnType<typeof userEvent.setup>,
  locale: Locale = "en",
) {
  const m = MESSAGES[locale];
  await screen.findByRole("dialog");
  await user.type(
    screen.getByRole("textbox", { name: /Title|Titre/ }),
    "Checkout fails",
  );
  await user.type(
    screen.getByRole("textbox", { name: /What happened|Que s'est-il passé/ }),
    "Pay does nothing",
  );
  await user.click(screen.getByRole("button", { name: m.submit }));
}

const en = MESSAGES.en;
/** The dialog, and the controls the key's config switches on. */
async function ready() {
  await screen.findByRole("dialog");
  await waitFor(() => expect(input()).not.toBeNull());
}

describe("attached files", () => {
  test("lists what was chosen and uploads each ticket after the report", async () => {
    const { user, onSubmitted } = setup();
    await ready();
    await user.upload(input(), [
      file("trace.png", "image/png", 2048),
      file("invoice.pdf", "application/pdf", 4096),
    ]);
    await screen.findAllByRole("list", { name: "Attachments" });
    const list = screen.getByTestId("files-section");
    expect(within(list).getAllByText("trace.png").length).toBeGreaterThan(0);
    expect(within(list).getAllByText("invoice.pdf").length).toBeGreaterThan(0);
    await fillAndSend(user);
    await screen.findByText(en.done.attached(2));
    expect(declared).toEqual([
      { role: "file", name: "trace.png", type: "image/png", size: 2048 },
      {
        role: "file",
        name: "invoice.pdf",
        type: "application/pdf",
        size: 4096,
      },
    ]);
    expect(puts.map((xhr) => [xhr.method, xhr.url])).toEqual([
      ["PUT", "https://pulsarix.test/public/media/report-files/slot0"],
      ["PUT", "https://pulsarix.test/public/media/report-files/slot1"],
    ]);
    expect(puts[0]?.headers).toEqual({
      "content-type": "image/png",
      "x-pulsarix-ticket": "ticket0",
    });
    expect(puts.every((xhr) => !xhr.withCredentials)).toBe(true);
    expect(onSubmitted).toHaveBeenCalledWith({
      reportId: "r1",
      files: [
        {
          name: "trace.png",
          role: "file",
          type: "image/png",
          size: 2048,
          uploaded: true,
        },
        {
          name: "invoice.pdf",
          role: "file",
          type: "application/pdf",
          size: 4096,
          uploaded: true,
        },
      ],
    });
  });

  test("a removed file is not declared", async () => {
    const { user } = setup();
    await ready();
    await user.upload(input(), [
      file("a.png", "image/png"),
      file("b.png", "image/png"),
    ]);
    await user.click(
      await screen.findByRole("button", { name: "Remove a.png" }),
    );
    await fillAndSend(user);
    await screen.findByText(en.done.attached(1));
    expect(declared.map((f) => f.name)).toEqual(["b.png"]);
  });

  test("a report with no file sends no files and no PUT", async () => {
    const { user, onSubmitted } = setup();
    await fillAndSend(user);
    await screen.findByText(en.done.noTracking);
    expect(declared).toEqual([]);
    expect(puts).toHaveLength(0);
    expect(onSubmitted).toHaveBeenCalledWith({ reportId: "r1", files: [] });
  });
});

describe("refusals, as the API would give them", () => {
  test("a type, a size and an empty file are refused with their reason and never sent", async () => {
    const { user } = setup();
    await ready();
    await user.upload(input(), [
      file("anim.gif", "image/gif"),
      file("huge.pdf", "application/pdf", 5 * 1024 * 1024 + 1),
      file("empty.png", "image/png", 0),
      file("ok.webp", "image/webp"),
    ]);
    await screen.findAllByRole("list", { name: "Attachments" });
    const list = screen.getByTestId("files-section");
    expect(within(list).getByText(en.files.reasons.type)).toBeTruthy();
    expect(within(list).getByText(en.files.reasons.size)).toBeTruthy();
    expect(within(list).getByText(en.files.reasons.unreadable)).toBeTruthy();
    await fillAndSend(user);
    await screen.findByText(en.done.attached(1));
    expect(declared.map((f) => f.name)).toEqual(["ok.webp"]);
  });

  test("a fourth file is refused: three at most", async () => {
    const { user } = setup();
    await ready();
    await user.upload(input(), [
      file("1.png", "image/png"),
      file("2.png", "image/png"),
      file("3.png", "image/png"),
      file("4.png", "image/png"),
    ]);
    await screen.findByText(en.files.count);
    await fillAndSend(user);
    await screen.findByText(en.done.attached(3));
    expect(declared.map((f) => f.name)).toEqual(["1.png", "2.png", "3.png"]);
  });

  test("files that pass 12 MB together are refused one by one", async () => {
    const { user } = setup();
    await ready();
    const mb = 1024 * 1024;
    await user.upload(input(), [
      file("a.pdf", "application/pdf", 5 * mb),
      file("b.pdf", "application/pdf", 5 * mb),
      file("c.pdf", "application/pdf", 3 * mb),
    ]);
    await screen.findByText(en.files.total);
    await fillAndSend(user);
    await screen.findByText(en.done.attached(2));
    expect(declared.map((f) => f.name)).toEqual(["a.pdf", "b.pdf"]);
  });
});

describe("partial failure and the one retry", () => {
  test("a refused file is worded in the confirmation and reported as not uploaded", async () => {
    answer = (xhr) =>
      xhr.url.endsWith("slot1")
        ? { status: 415, code: "intake.errors.file-unsupported-type" }
        : { status: 200 };
    const { user, onSubmitted } = setup();
    await ready();
    await user.upload(input(), [
      file("a.png", "image/png"),
      file("fake.pdf", "application/pdf"),
    ]);
    await fillAndSend(user);
    await screen.findByText(en.done.partial(1, 2));
    expect(screen.getByText(en.done.partialTitle)).toBeTruthy();
    expect(screen.getByText("fake.pdf")).toBeTruthy();
    expect(
      screen.getByText(new RegExp(en.files.reasons.type.slice(0, 20))),
    ).toBeTruthy();
    // A 415 is final: no second attempt.
    expect(puts.filter((xhr) => xhr.url.endsWith("slot1"))).toHaveLength(1);
    const detail = onSubmitted.mock.calls[0]?.[0] as {
      files: { name: string; uploaded: boolean }[];
    };
    expect(detail.files.map((f) => [f.name, f.uploaded])).toEqual([
      ["a.png", true],
      ["fake.pdf", false],
    ]);
  });

  test("a dropped connection is retried once, then succeeds", async () => {
    answer = (_xhr, attempt) =>
      attempt === 1 ? { status: 0 } : { status: 200 };
    const { user } = setup();
    await ready();
    await user.upload(input(), [file("a.png", "image/png")]);
    await fillAndSend(user);
    await screen.findByText(en.done.attached(1));
    expect(puts).toHaveLength(2);
  });

  test("two failures end as a partial failure", async () => {
    answer = () => ({ status: 503, code: "intake.errors.unavailable" });
    const { user } = setup();
    await ready();
    await user.upload(input(), [file("a.png", "image/png")]);
    await fillAndSend(user);
    await screen.findByText(en.done.partial(1, 1));
    expect(puts).toHaveLength(2);
    expect(screen.getByText(new RegExp(en.files.reasons.busy))).toBeTruthy();
  });

  test("a report the API refuses for its files stays open with a files message", async () => {
    globalThis.fetch = mock(async (_u: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { id: string };
      if (body.id === "widgetConfig")
        return json({
          data: { widgetConfig: { enabled: true, attachments: true } },
        });
      return json(
        {
          errors: [
            {
              message: "At most 3 files.",
              extensions: { code: "intake.errors.too-many-files" },
            },
          ],
        },
        400,
      );
    }) as unknown as typeof fetch;
    const { user } = setup();
    await ready();
    await user.upload(input(), [file("a.png", "image/png")]);
    await fillAndSend(user);
    await screen.findByText("At most 3 files.");
    expect(puts).toHaveLength(0);
  });
});

describe("the controls can be off", () => {
  test("data-attachments=false: no files section, no screenshot pane, no files sent", async () => {
    const { user } = setup({ attachments: false });
    await screen.findByRole("dialog");
    expect(input()).toBeNull();
    expect(screen.queryByText(en.files.label)).toBeNull();
    expect(
      screen.queryByRole("button", { name: en.screenshot.add }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: en.screenshot.upload }),
    ).toBeNull();
    await fillAndSend(user);
    await screen.findByText(en.done.noTracking);
    expect(declared).toEqual([]);
  });

  test("the key's own switch (widgetConfig.attachments=false) hides them too", async () => {
    configAttachments = false;
    setup();
    await waitFor(() => expect(screen.queryByText(en.files.label)).toBeNull());
    expect(
      screen.queryByRole("button", { name: en.screenshot.add }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: en.screenshot.upload }),
    ).toBeNull();
  });
});

describe("French", () => {
  test("the section, the refusals and the partial failure speak French", async () => {
    const fr = MESSAGES.fr;
    answer = () => ({ status: 413, code: "intake.errors.file-too-large" });
    const { user } = setup({ locale: "fr" });
    await screen.findByRole("dialog");
    await waitFor(() => expect(screen.getByText(fr.files.label)).toBeTruthy());
    expect(
      screen.getByRole("button", { name: fr.screenshot.upload }),
    ).toBeTruthy();
    await user.upload(input(), [
      file("a.png", "image/png"),
      file("x.gif", "image/gif"),
    ]);
    await screen.findAllByRole("list");
    const list = screen.getByTestId("files-section");
    expect(within(list).getByText(fr.files.reasons.type)).toBeTruthy();
    // The material list's own labels follow the locale (embed I18nProvider).
    expect(
      within(list).getByRole("button", { name: "Retirer a.png" }),
    ).toBeTruthy();
    expect(within(list).queryByRole("button", { name: /^Remove/ })).toBeNull();
    await fillAndSend(user, "fr");
    await screen.findByText(fr.done.partial(1, 1));
    expect(
      screen.getByText(new RegExp(fr.files.reasons.size.slice(0, 14))),
    ).toBeTruthy();
  });
});

afterAll(() => {
  mock.module("../../screenshot/components/editor-host", () => realEditor);
});
