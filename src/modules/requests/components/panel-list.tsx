import {
  Alert,
  Button,
  ChipGroupField,
  EmptyState,
  SkeletonText,
} from "@softistx/material/embed";
import type { Locale } from "../../../config";
import type { Messages } from "../../../core/messages";
import type { RequestCounts, RequestFilter, RequestSummary } from "../api";
import type { useRequestList } from "../hooks/use-request-list";
import { errorText } from "../model/error-text";
import { REQUESTS_MESSAGES } from "../model/messages";
import { Privacy } from "./privacy";
import { RequestList } from "./request-list";

const FILTERS: RequestFilter[] = ["OPEN", "RESOLVED", "DECLINED", "ALL"];
const COUNT_KEY: Record<RequestFilter, keyof RequestCounts> = {
  OPEN: "open",
  RESOLVED: "resolved",
  DECLINED: "declined",
  ALL: "all",
};

/**
 * The panel's body: the filter chips with their counts, the load and error states, the list,
 * "more" and the privacy controls. The panel owns the list's state and passes it in.
 */
export function RequestsListBody({
  messages,
  locale,
  apiBase,
  projectKey,
  identity,
  list,
  onOpen,
  onNewRequest,
  onErase,
}: {
  messages: Messages;
  locale: Locale;
  apiBase: string | null;
  projectKey: string | null;
  identity: string;
  list: ReturnType<typeof useRequestList>;
  onOpen: (request: RequestSummary) => void;
  onNewRequest: () => void;
  onErase?: (detail: { requests: number }) => void;
}) {
  const text = REQUESTS_MESSAGES[locale];
  const { filter, counts, nodes, load } = list;
  const total = counts?.all ?? null;
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 pb-3">
      {(total === 0 && load.status === "ready") ||
      load.status === "error" ? null : (
        <div className="max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)]">
          <ChipGroupField
            label={text.filterLabel}
            hideLabel
            overflow="scroll-phone"
            value={filter}
            onValueChange={(value) =>
              value && list.setFilter(value as RequestFilter)
            }
            options={FILTERS.map((value) => ({
              value,
              label: text.filters[value],
              ...(counts ? { count: counts[COUNT_KEY[value]] } : {}),
            }))}
          />
        </div>
      )}
      {load.status === "error" ? (
        <Alert
          variant="error"
          title={text.errors.title}
          description={errorText(text, load.error)}
          // An identity error has no retry: the footer's Close is the way out, once.
          actions={
            load.error.kind === "identity" ? undefined : (
              <Button
                type="button"
                variant="tonal"
                size="sm"
                onClick={list.reload}
              >
                {text.retry}
              </Button>
            )
          }
        />
      ) : null}
      {list.erased !== null ? (
        <Alert
          variant="success"
          description={text.privacy.erased(list.erased)}
        />
      ) : null}
      {load.status === "loading" ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">{text.loading}</span>
          <SkeletonText lines={4} labelled={false} />
        </div>
      ) : null}
      {load.status === "ready" && nodes.length === 0 ? (
        total === 0 ? (
          <EmptyState
            size="compact"
            headingLevel={3}
            title={text.none.title}
            description={text.none.body}
            action={
              <Button type="button" onClick={onNewRequest}>
                {text.none.action}
              </Button>
            }
          />
        ) : (
          <EmptyState
            kind="search"
            size="compact"
            title={filter === "ALL" ? text.none.title : text.empty[filter]}
          />
        )
      ) : null}
      {nodes.length > 0 ? (
        <RequestList
          messages={messages}
          locale={locale}
          label={text.filters[filter]}
          nodes={nodes}
          onOpen={onOpen}
        />
      ) : null}
      {list.hasMore && load.status === "ready" ? (
        <Button
          type="button"
          variant="tonal"
          loading={list.paging}
          className="justify-self-center"
          onClick={list.more}
        >
          {text.more}
        </Button>
      ) : null}
      {load.status === "ready" && (total ?? 0) > 0 ? (
        <Privacy
          locale={locale}
          apiBase={apiBase}
          projectKey={projectKey}
          identity={identity}
          emailsOn={list.emailsOn}
          onErased={(requests) => {
            list.empty(requests);
            onErase?.({ requests });
          }}
        />
      ) : null}
    </div>
  );
}
