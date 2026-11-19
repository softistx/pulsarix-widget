/**
 * A stand-in for the API's `myRequests` operation (plan section 19, A17) in the fixture server.
 * The identity token picks the case: `fixture.token` has six requests, `empty.token` none, and
 * `expired.token` (or none at all) is refused with 401, as a forged or expired token is.
 */
type State = "received" | "inProgress" | "resolved" | "declined";

interface Request {
  id: string;
  title: string;
  publicState: State;
  impact: string | null;
  type: string | null;
  createdAt: string;
  declineReason: string | null;
  unread: number;
}

const REQUESTS: Request[] = [
  {
    id: "r1",
    title: "The pay button does nothing on the cart page",
    publicState: "inProgress",
    impact: "blocking",
    type: "bug",
    createdAt: "2026-11-16T14:20:00Z",
    declineReason: null,
    unread: 0,
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
  },
];

const matches = (filter: string, state: State) =>
  filter === "ALL" ||
  (filter === "OPEN" && (state === "received" || state === "inProgress")) ||
  (filter === "RESOLVED" && state === "resolved") ||
  (filter === "DECLINED" && state === "declined");

const refused = () =>
  Response.json(
    {
      errors: [
        {
          message: "identity",
          extensions: { code: "intake.errors.identity-invalid" },
        },
      ],
    },
    { status: 401 },
  );

export function answerMyRequests(
  identity: string | null,
  variables: { filter?: string; first?: number; after?: string },
): Response {
  if (!identity || identity.startsWith("expired")) return refused();
  const all = identity.startsWith("empty") ? [] : REQUESTS;
  const open = all.filter((r) => matches("OPEN", r.publicState)).length;
  const resolved = all.filter((r) => r.publicState === "resolved").length;
  const declined = all.filter((r) => r.publicState === "declined").length;
  const wanted = all.filter((r) =>
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
        nodes: page,
        counts: { open, resolved, declined, all: all.length },
        unread: all.reduce((sum, r) => sum + r.unread, 0),
        emailsOn: true,
        endCursor: page.at(-1)?.id ?? null,
        hasNextPage: start + page.length < sorted.length,
      },
    },
  });
}
