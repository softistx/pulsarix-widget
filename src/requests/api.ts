/** The reporter's side of the public endpoint that "My requests" reads (plan section 19, A17). */
import { publicCall } from "../api";

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
