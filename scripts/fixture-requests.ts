/**
 * A stand-in for the API's request operations (`myRequests`, `request`, `replyToRequest`,
 * `resolveRequest`, `reopenRequest`, `markRequestRead`; plan section 19, A17) and for the live
 * stream `GET /public/live/requests`, in the fixture server. The identity token picks the
 * case: `fixture.token` has six requests, `empty.token` none, and `expired.token` (or none at
 * all) is refused with 401, as a forged or expired token is. The state is per server: a reply,
 * a resolve or a read lasts until the server stops.
 */
import { apiMessage } from "./fixture-messages";

type State = "received" | "inProgress" | "resolved" | "declined";

interface Message {
  id: string;
  from: "reporter" | "team";
  body: string;
  at: string;
  files: { id: string; name: string; thumbnailUrl: string | null }[];
}

interface Request {
  id: string;
  title: string;
  publicState: State;
  impact: string | null;
  type: string | null;
  createdAt: string;
  declineReason: string | null;
  unread: number;
  description: string;
  thread: Message[];
  files: Message["files"];
  canReopen: boolean;
  resolvedAt: string | null;
}

const team = (
  id: string,
  at: string,
  body: string,
  files: Message["files"] = [],
): Message => ({ id, from: "team", body, at, files });
const you = (id: string, at: string, body: string): Message => ({
  id,
  from: "reporter",
  body,
  at,
  files: [],
});

function seed(): Request[] {
  return [
    {
      id: "r1",
      title: "The pay button does nothing on the cart page",
      publicState: "inProgress",
      impact: "blocking",
      type: "bug",
      createdAt: "2026-11-16T14:20:00Z",
      declineReason: null,
      unread: 0,
      description:
        "When I press Pay on the cart page nothing happens, on Chrome and on my phone.",
      files: [{ id: "f1", name: "screenshot.png", thumbnailUrl: null }],
      thread: [
        team(
          "m1",
          "2026-11-16T15:02:00Z",
          "Thanks, we could reproduce it. Does it happen with every card?",
        ),
        you("m2", "2026-11-16T15:30:00Z", "Yes, with both of my cards."),
        team(
          "m3",
          "2026-11-17T08:12:00Z",
          "Found it: a script failed to load. A fix is in progress.",
        ),
      ],
      canReopen: false,
      resolvedAt: null,
    },
    {
      id: "r2",
      title: "How do I change the billing e-mail of my account?",
      publicState: "received",
      impact: null,
      type: "question",
      createdAt: "2026-11-17T09:05:00Z",
      declineReason: null,
      unread: 2,
      description:
        "I changed jobs and need the invoices sent to my new address. Where is that setting?",
      files: [],
      thread: [
        team(
          "m1",
          "2026-11-17T10:00:00Z",
          "Hello! It is under Account, then Billing. The e-mail field is the second one.",
        ),
        team(
          "m2",
          "2026-11-17T10:01:00Z",
          "Here is a picture of where it is.",
          [{ id: "f2", name: "billing-settings.png", thumbnailUrl: null }],
        ),
      ],
      canReopen: false,
      resolvedAt: null,
    },
    {
      id: "r3",
      title: "Export the invoices as a CSV file",
      publicState: "received",
      impact: "minor",
      type: "suggestion",
      createdAt: "2026-11-12T16:40:00Z",
      declineReason: null,
      unread: 1,
      description: "A CSV export of the invoices would help my accountant.",
      files: [],
      thread: [
        team(
          "m1",
          "2026-11-13T09:00:00Z",
          "Good idea, we noted it for the roadmap.",
        ),
      ],
      canReopen: false,
      resolvedAt: null,
    },
    {
      id: "r4",
      title: "The product images load slowly on a phone",
      publicState: "resolved",
      impact: "annoying",
      type: "bug",
      createdAt: "2026-10-28T11:00:00Z",
      declineReason: null,
      unread: 0,
      description: "On 4G the product pictures take more than ten seconds.",
      files: [],
      thread: [
        team(
          "m1",
          "2026-10-29T09:00:00Z",
          "We now serve smaller pictures on phones.",
        ),
        you("m2", "2026-10-29T18:00:00Z", "Much faster, thank you."),
      ],
      canReopen: true,
      resolvedAt: "2026-11-10T12:00:00Z",
    },
    {
      id: "r5",
      title: "Typo in the shipping policy",
      publicState: "resolved",
      impact: "minor",
      type: "bug",
      createdAt: "2026-10-20T08:15:00Z",
      declineReason: null,
      unread: 0,
      description: '"Delivary" is missing an e in the second paragraph.',
      files: [],
      thread: [
        team("m1", "2026-10-20T09:00:00Z", "Fixed, thanks for the catch."),
      ],
      canReopen: false,
      resolvedAt: "2026-09-30T12:00:00Z",
    },
    {
      id: "r6",
      title: "Add a dark mode to the store",
      publicState: "declined",
      impact: null,
      type: "suggestion",
      createdAt: "2026-10-02T19:30:00Z",
      declineReason: "Not planned for this year.",
      unread: 0,
      description: "A dark theme would be easier on the eyes at night.",
      files: [],
      thread: [],
      canReopen: false,
      resolvedAt: null,
    },
  ];
}

const matches = (filter: string, state: State) =>
  filter === "ALL" ||
  (filter === "OPEN" && (state === "received" || state === "inProgress")) ||
  (filter === "RESOLVED" && state === "resolved") ||
  (filter === "DECLINED" && state === "declined");

const failure = (
  status: number,
  code: string,
  language: string | null,
  minutes?: number,
) =>
  Response.json(
    {
      errors: [
        {
          message: apiMessage(code, language, minutes),
          extensions: {
            code: `intake.errors.${code}`,
            ...(minutes === undefined
              ? {}
              : { minutes, retryAfter: minutes * 60 }),
          },
        },
      ],
    },
    { status },
  );
const summary = ({
  id,
  title,
  publicState,
  impact,
  type,
  createdAt,
  declineReason,
  unread,
}: Request) => ({
  id,
  title,
  publicState,
  impact,
  type,
  createdAt,
  declineReason,
  unread,
});

interface Vars {
  filter?: string;
  first?: number;
  after?: string;
  on?: boolean;
  id?: string;
  input?: { body?: string; files?: { name: string }[] };
}

export function createRequestsStub() {
  const all = seed();
  /** The open live streams, and how many were ever opened (specs read both). */
  const streams = new Set<(chunk: string) => void>();
  const stats = { opened: 0, closed: 0 };
  const unreadOf = (rows: Request[]) =>
    rows.reduce((sum, r) => sum + r.unread, 0);
  const rowsFor = (identity: string) =>
    identity.startsWith("empty") ? [] : all;
  const emit = (event: string, data: object) => {
    for (const write of streams)
      write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  let counter = 100;
  /** The e-mail choice, per stub (so per server), shared by every identity. */
  let emailsOn = true;
  const calls = { setRequestEmails: [] as boolean[], eraseMyData: 0 };

  return {
    calls,
    stats,
    streamCount: () => streams.size,
    /** A team reply lands: the open streams hear `request.updated` and `unread`. */
    teamReplies(id: string, body: string) {
      const row = all.find((r) => r.id === id);
      if (!row) return false;
      row.thread.push(team(`m${++counter}`, new Date().toISOString(), body));
      row.unread++;
      emit("request.updated", {
        id,
        publicState: row.publicState,
        unread: row.unread,
      });
      emit("unread", { count: unreadOf(all) });
      return true;
    },
    /** `GET /public/live/requests`: an event stream that ends when the page drops it. */
    live(identity: string | null, signal: AbortSignal): Response {
      if (!identity || identity.startsWith("expired"))
        return failure(401, "identity-invalid", null);
      const encoder = new TextEncoder();
      let write: (chunk: string) => void = () => {};
      const body = new ReadableStream({
        start(controller) {
          write = (chunk) => {
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch {
              // closed
            }
          };
          streams.add(write);
          stats.opened++;
          write(
            `event: unread\ndata: ${JSON.stringify({ count: unreadOf(rowsFor(identity)) })}\n\n`,
          );
          const ping = setInterval(() => write(": ping\n\n"), 15_000);
          signal.addEventListener("abort", () => {
            clearInterval(ping);
            if (streams.delete(write)) stats.closed++;
            try {
              controller.close();
            } catch {
              // closed
            }
          });
        },
        cancel() {
          if (streams.delete(write)) stats.closed++;
        },
      });
      return new Response(body, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
        },
      });
    },
    /** Answers a persisted operation, or null when it is not one of these. */
    answer(
      op: string,
      identity: string | null,
      variables: Vars,
      /** Declares a file to upload and returns its ticket (the fixture's upload stub). */
      ticketFor: (name: string) => {
        slot: string;
        role: string;
        ticket: string;
      },
      /** The request's `accept-language`: the API words its refusals in it. */
      language: string | null = null,
    ): Response | null {
      const names = [
        "myRequests",
        "request",
        "replyToRequest",
        "resolveRequest",
        "reopenRequest",
        "markRequestRead",
        "setRequestEmails",
        "eraseMyData",
      ];
      if (!names.includes(op)) return null;
      if (!identity || identity.startsWith("expired"))
        return failure(401, "identity-invalid", language);
      const rows = rowsFor(identity);
      // `limited.token` gets the API's 429 on the two privacy writes (the error states).
      if (
        (op === "setRequestEmails" || op === "eraseMyData") &&
        identity.startsWith("limited")
      )
        return failure(429, "too-many-requests", language, 10);
      if (op === "setRequestEmails") {
        emailsOn = variables.on === true;
        calls.setRequestEmails.push(emailsOn);
        return Response.json({ data: { setRequestEmails: true } });
      }
      if (op === "eraseMyData") {
        calls.eraseMyData++;
        const requests = rows.length;
        if (rows === all) all.length = 0;
        return Response.json({ data: { eraseMyData: { requests } } });
      }
      if (op === "myRequests") {
        const open = rows.filter((r) => matches("OPEN", r.publicState)).length;
        const resolved = rows.filter(
          (r) => r.publicState === "resolved",
        ).length;
        const declined = rows.filter(
          (r) => r.publicState === "declined",
        ).length;
        const wanted = rows.filter((r) =>
          matches(variables.filter ?? "OPEN", r.publicState),
        );
        const sorted = [
          ...wanted.filter((r) => r.unread > 0),
          ...wanted.filter((r) => r.unread === 0),
        ];
        const start = variables.after
          ? sorted.findIndex((r) => r.id === variables.after) + 1
          : 0;
        const page = sorted.slice(start, start + (variables.first ?? 20));
        return Response.json({
          data: {
            myRequests: {
              nodes: page.map(summary),
              counts: { open, resolved, declined, all: rows.length },
              unread: unreadOf(rows),
              emailsOn,
              endCursor: page.at(-1)?.id ?? null,
              hasNextPage: start + page.length < sorted.length,
            },
          },
        });
      }
      const row = rows.find((r) => r.id === variables.id);
      if (!row) return failure(404, "not-found", language);
      if (op === "request")
        return Response.json({
          data: {
            request: {
              ...summary(row),
              description: row.description,
              thread: row.thread,
              files: row.files,
              canReply: row.publicState !== "declined",
              canReopen: row.publicState === "resolved" && row.canReopen,
              resolvedAt: row.resolvedAt,
              emailsOn,
            },
          },
        });
      if (op === "markRequestRead") {
        row.unread = 0;
        return Response.json({
          data: { markRequestRead: { count: unreadOf(rows) } },
        });
      }
      if (op === "replyToRequest") {
        if (row.publicState === "declined")
          return failure(409, "request-declined", language);
        const files = (variables.input?.files ?? []).map((f) =>
          ticketFor(f.name),
        );
        const id = `m${++counter}`;
        row.thread.push({
          id,
          from: "reporter",
          body: variables.input?.body ?? "",
          at: new Date().toISOString(),
          files: (variables.input?.files ?? []).map((f, i) => ({
            id: `file-${id}-${i}`,
            name: f.name,
            thumbnailUrl: null,
          })),
        });
        return Response.json({
          data: { replyToRequest: { messageId: id, files } },
        });
      }
      if (op === "resolveRequest") {
        row.publicState = "resolved";
        row.canReopen = true;
        row.resolvedAt = new Date().toISOString();
        return Response.json({ data: { resolveRequest: summary(row) } });
      }
      // reopenRequest
      if (!row.canReopen) return failure(409, "reopen-expired", language);
      row.publicState = "received";
      row.resolvedAt = null;
      return Response.json({ data: { reopenRequest: summary(row) } });
    },
  };
}
