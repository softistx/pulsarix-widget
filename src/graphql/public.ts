/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type MetadataEntryInput = {
  key: string;
  value: string;
};

/** What a reporter sees of a request: the status's name never leaves. */
export type PublicState =
  | 'declined'
  | 'inProgress'
  | 'received'
  | 'resolved';

/** A file the report will carry: its bytes follow by PUT, one ticket each. */
export type ReportFileInput = {
  name: string;
  role: ReportFileRole;
  /** Bytes, at most 5 MB each and 12 MB together. */
  size: number;
  /** png, jpeg or webp; a PDF for a file, never for a screenshot. */
  type: string;
};

export type ReportFileRole =
  | 'file'
  | 'screenshot';

/** How much the problem blocks the reporter. */
export type ReportImpact =
  | 'annoying'
  | 'blocking'
  | 'minor';

export type ReportType =
  | 'bug'
  | 'question'
  | 'suggestion';

export type RequestFilter =
  | 'ALL'
  | 'DECLINED'
  | 'OPEN'
  | 'RESOLVED';

export type RequestReplyInput = {
  body: string;
  /** At most 3 files, as a report's. */
  files?: Array<ReportFileInput> | null | undefined;
};

export type SubmitClientReportInput = {
  description: string;
  email?: string | null | undefined;
  /** At most 1 screenshot and 3 files. */
  files?: Array<ReportFileInput> | null | undefined;
  /** How long the form was open before it was sent, in milliseconds. */
  filledInMs: number;
  impact?: ReportImpact | null | undefined;
  locale?: string | null | undefined;
  metadata?: Array<MetadataEntryInput> | null | undefined;
  pageUrl?: string | null | undefined;
  title: string;
  type?: ReportType | null | undefined;
  /** Honeypot: a real form leaves it empty. */
  website?: string | null | undefined;
};

export type ClientReportStatusQueryVariables = Exact<{
  token?: string | null | undefined;
}>;


export type ClientReportStatusQuery = { clientReportStatus: { state: string, publicState: PublicState, declineReason: string | null, title: string, createdAt: string, id: string, description: string, impact: string | null, type: string | null, canReply: boolean, canReopen: boolean, resolvedAt: string | null, emailsOn: boolean, replies: Array<{ at: string, body: string }>, files: Array<{ id: string, role: string, name: string, thumbnailUrl: string | null }>, thread: Array<{ id: string, from: string, body: string, at: string, files: Array<{ id: string, name: string, thumbnailUrl: string | null }> }> } };

export type EraseMyDataMutationVariables = Exact<{
  publicKey: string;
}>;


export type EraseMyDataMutation = { eraseMyData: { requests: number } };

export type MarkRequestReadMutationVariables = Exact<{
  publicKey: string;
  id: string | number;
}>;


export type MarkRequestReadMutation = { markRequestRead: { count: number } };

export type MyRequestsQueryVariables = Exact<{
  publicKey: string;
  filter?: RequestFilter | null | undefined;
  first?: number | null | undefined;
  after?: string | number | null | undefined;
}>;


export type MyRequestsQuery = { myRequests: { unread: number, emailsOn: boolean, endCursor: string | null, hasNextPage: boolean, nodes: Array<{ id: string, title: string, publicState: PublicState, impact: string | null, type: string | null, createdAt: string, declineReason: string | null, unread: number }>, counts: { open: number, resolved: number, declined: number, all: number } } };

export type ReopenRequestMutationVariables = Exact<{
  publicKey: string;
  id: string | number;
}>;


export type ReopenRequestMutation = { reopenRequest: { id: string, title: string, publicState: PublicState, impact: string | null, type: string | null, createdAt: string, declineReason: string | null, unread: number } };

export type ReplyToRequestMutationVariables = Exact<{
  publicKey: string;
  id: string | number;
  input: RequestReplyInput;
}>;


export type ReplyToRequestMutation = { replyToRequest: { messageId: string, files: Array<{ slot: string, role: ReportFileRole, ticket: string, expiresAt: string }> } };

export type RequestQueryVariables = Exact<{
  publicKey: string;
  id: string | number;
}>;


export type RequestQuery = { request: { id: string, title: string, description: string, publicState: PublicState, impact: string | null, type: string | null, createdAt: string, declineReason: string | null, unread: number, canReply: boolean, canReopen: boolean, resolvedAt: string | null, emailsOn: boolean, thread: Array<{ id: string, from: string, body: string, at: string, files: Array<{ id: string, name: string, thumbnailUrl: string | null }> }>, files: Array<{ id: string, name: string, thumbnailUrl: string | null }> } };

export type ResolveRequestMutationVariables = Exact<{
  publicKey: string;
  id: string | number;
}>;


export type ResolveRequestMutation = { resolveRequest: { id: string, title: string, publicState: PublicState, impact: string | null, type: string | null, createdAt: string, declineReason: string | null, unread: number } };

export type SetRequestEmailsMutationVariables = Exact<{
  publicKey: string;
  on: boolean;
}>;


export type SetRequestEmailsMutation = { setRequestEmails: boolean };

export type SubmitClientReportMutationVariables = Exact<{
  publicKey: string;
  input: SubmitClientReportInput;
}>;


export type SubmitClientReportMutation = { submitClientReport: { reportId: string, tracking: boolean, files: Array<{ slot: string, role: ReportFileRole, ticket: string, expiresAt: string }> } };

export type TrackingEmailsMutationVariables = Exact<{
  on: boolean;
}>;


export type TrackingEmailsMutation = { trackingEmails: boolean };

export type TrackingEraseMutationVariables = Exact<{ [key: string]: never; }>;


export type TrackingEraseMutation = { trackingErase: { requests: number } };

export type TrackingReopenMutationVariables = Exact<{ [key: string]: never; }>;


export type TrackingReopenMutation = { trackingReopen: { id: string, title: string, publicState: PublicState, impact: string | null, type: string | null, createdAt: string, declineReason: string | null, unread: number } };

export type TrackingReplyMutationVariables = Exact<{
  input: RequestReplyInput;
}>;


export type TrackingReplyMutation = { trackingReply: { messageId: string, files: Array<{ slot: string, role: ReportFileRole, ticket: string, expiresAt: string }> } };

export type TrackingResolveMutationVariables = Exact<{ [key: string]: never; }>;


export type TrackingResolveMutation = { trackingResolve: { id: string, title: string, publicState: PublicState, impact: string | null, type: string | null, createdAt: string, declineReason: string | null, unread: number } };

export type WidgetConfigQueryVariables = Exact<{
  publicKey: string;
}>;


export type WidgetConfigQuery = { widgetConfig: { projectName: string | null, locale: string, enabled: boolean, attachments: boolean } };

/** The persisted operations the API serves on `/public/graphql`, by id. */
export type PersistedId =
  | "clientReportStatus"
  | "eraseMyData"
  | "markRequestRead"
  | "myRequests"
  | "reopenRequest"
  | "replyToRequest"
  | "request"
  | "resolveRequest"
  | "setRequestEmails"
  | "submitClientReport"
  | "trackingEmails"
  | "trackingErase"
  | "trackingReopen"
  | "trackingReply"
  | "trackingResolve"
  | "widgetConfig";
