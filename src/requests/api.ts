/** The reporter's side of the public endpoint that "My requests" reads (plan section 19, A17). */
import { type DeclaredFile, type FileTicket, publicCall } from "../api";

export type PublicState = "received" | "inProgress" | "resolved" | "declined";
export type RequestFilter = "OPEN" | "RESOLVED" | "DECLINED" | "ALL";

export interface RequestSummary {
  id: string;
  title: string;
  publicState: PublicState;
  impact: string | null;
  type: string | null;
  createdAt: string;
  declineReason: string | null;
  /** The team's replies not read yet. */
  unread: number;
}

export interface RequestCounts {
  open: number;
  resolved: number;
  declined: number;
  all: number;
}

export interface MyRequests {
  nodes: RequestSummary[];
  counts: RequestCounts;
  /** Unread replies over every request: the launcher's badge. */
  unread: number;
  emailsOn: boolean;
  endCursor: string | null;
  hasNextPage: boolean;
}

/** One page of the reporter's requests; unread ones come first. */
export function fetchMyRequests({
  apiBase,
  publicKey,
  identity,
  locale,
  filter = "OPEN",
  first = 20,
  after,
  fetch,
  signal,
}: {
  apiBase: string;
  publicKey: string;
  identity: string;
  locale: string;
  filter?: RequestFilter;
  first?: number;
  after?: string | null;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}): Promise<MyRequests> {
  return publicCall<MyRequests>({
    apiBase,
    id: "myRequests",
    variables: { publicKey, filter, first, ...(after ? { after } : {}) },
    locale,
    identity,
    fetch,
    signal,
  });
}

/** The unread count alone (the launcher's badge): the smallest page, its `unread`. */
export async function fetchUnread(
  options: Omit<Parameters<typeof fetchMyRequests>[0], "first" | "filter">,
): Promise<number> {
  const page = await fetchMyRequests({ ...options, first: 1 });
  return page.unread;
}

export interface RequestFileRef {
  id: string;
  name: string;
  /** Needs the identity header to read, so the thread shows the name only. */
  thumbnailUrl: string | null;
}

export interface ThreadMessage {
  id: string;
  from: "reporter" | "team";
  body: string;
  at: string;
  files: RequestFileRef[];
}

export interface RequestDetail extends RequestSummary {
  description: string;
  thread: ThreadMessage[];
  files: RequestFileRef[];
  canReply: boolean;
  canReopen: boolean;
  resolvedAt: string | null;
  emailsOn: boolean;
}

interface CallBase {
  apiBase: string;
  publicKey: string;
  identity: string;
  locale: string;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

/** One request with its thread. */
export function fetchRequest({
  id,
  publicKey,
  ...rest
}: CallBase & { id: string }): Promise<RequestDetail> {
  return publicCall<RequestDetail>({
    ...rest,
    id: "request",
    variables: { publicKey, id },
  });
}

/** The reply's text is saved; each declared file then goes up by its ticket (the W2c path). */
export function replyToRequest({
  id,
  publicKey,
  body,
  files,
  ...rest
}: CallBase & {
  id: string;
  body: string;
  files: DeclaredFile[];
}): Promise<{ messageId: string; files: FileTicket[] }> {
  return publicCall({
    ...rest,
    id: "replyToRequest",
    variables: {
      publicKey,
      id,
      input: { body, ...(files.length ? { files } : {}) },
    },
  });
}

export function resolveRequest({
  id,
  publicKey,
  ...rest
}: CallBase & { id: string }): Promise<RequestSummary> {
  return publicCall<RequestSummary>({
    ...rest,
    id: "resolveRequest",
    variables: { publicKey, id },
  });
}

export function reopenRequest({
  id,
  publicKey,
  ...rest
}: CallBase & { id: string }): Promise<RequestSummary> {
  return publicCall<RequestSummary>({
    ...rest,
    id: "reopenRequest",
    variables: { publicKey, id },
  });
}

/** Marks the thread read; answers the unread count over every request. */
export function markRequestRead({
  id,
  publicKey,
  ...rest
}: CallBase & { id: string }): Promise<{ count: number }> {
  return publicCall<{ count: number }>({
    ...rest,
    id: "markRequestRead",
    variables: { publicKey, id },
  });
}

/** The e-mail choice: applies to every request of the identity under this key. */
export function setRequestEmails({
  publicKey,
  on,
  ...rest
}: CallBase & { on: boolean }): Promise<boolean> {
  return publicCall<boolean>({
    ...rest,
    id: "setRequestEmails",
    variables: { publicKey, on },
  });
}

/** Erases every request of the identity under this key; answers how many went. */
export function eraseMyData({
  publicKey,
  ...rest
}: CallBase): Promise<{ requests: number }> {
  return publicCall<{ requests: number }>({
    ...rest,
    id: "eraseMyData",
    variables: { publicKey },
  });
}
