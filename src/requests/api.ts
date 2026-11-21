/** The reporter's side of the public endpoint that "My requests" reads (plan section 19, A17). */
import { type DeclaredFile, type FileTicket, publicCall } from "../api";
import type {
  EraseMyDataMutation,
  MarkRequestReadMutation,
  MyRequestsQuery,
  PublicState,
  RequestFilter,
  RequestQuery,
  SetRequestEmailsMutation,
} from "../graphql/public";

export type { PublicState, RequestFilter };

export type MyRequests = MyRequestsQuery["myRequests"];
export type RequestSummary = MyRequests["nodes"][number];
export type RequestCounts = MyRequests["counts"];

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
  return publicCall({
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

export type RequestFileRef = RequestQuery["request"]["files"][number];

export type ThreadMessage = Omit<
  RequestQuery["request"]["thread"][number],
  "from"
> & {
  from: "reporter" | "team";
};

export type RequestDetail = Omit<RequestQuery["request"], "thread"> & {
  thread: ThreadMessage[];
};

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
  // The API words a message's author as a string; its two values are narrowed here, the one cast.
  return publicCall({
    ...rest,
    id: "request",
    variables: { publicKey, id },
  }) as Promise<RequestDetail>;
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
  return publicCall({
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
  return publicCall({
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
}: CallBase & { id: string }): Promise<
  MarkRequestReadMutation["markRequestRead"]
> {
  return publicCall({
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
}: CallBase & { on: boolean }): Promise<
  SetRequestEmailsMutation["setRequestEmails"]
> {
  return publicCall({
    ...rest,
    id: "setRequestEmails",
    variables: { publicKey, on },
  });
}

/** Erases every request of the identity under this key; answers how many went. */
export function eraseMyData({
  publicKey,
  ...rest
}: CallBase): Promise<EraseMyDataMutation["eraseMyData"]> {
  return publicCall({
    ...rest,
    id: "eraseMyData",
    variables: { publicKey },
  });
}
