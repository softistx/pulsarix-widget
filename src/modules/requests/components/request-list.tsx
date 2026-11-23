import { Badge, ListRow } from "@softistx/material/embed";
import type { Locale } from "../../../config";
import type { Messages } from "../../../core/messages";
import type { PublicState, RequestSummary } from "../api";
import { REQUESTS_MESSAGES } from "../model/messages";
import { STATE_TONE } from "../model/state-tone";

export interface RequestListProps {
  messages: Messages;
  locale: Locale;
  label: string;
  nodes: RequestSummary[];
  onOpen: (request: RequestSummary) => void;
}

/**
 * The reporter's requests, one row each. Each row is a container: from `@md` the status badge
 * sits at the row's end; below it the badge moves under the title (with the meta line) and both
 * lines wrap, so a narrow phone never cuts the title or the meta to an ellipsis.
 */
export function RequestList({
  messages,
  locale,
  label,
  nodes,
  onOpen,
}: RequestListProps) {
  const text = REQUESTS_MESSAGES[locale];
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const stateBadge = (state: PublicState) => (
    <Badge variant="soft" tone={STATE_TONE[state]}>
      {text.states[state]}
    </Badge>
  );
  return (
    <ul
      aria-label={label}
      className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-2 p-0"
    >
      {nodes.map((request) => (
        <li
          key={request.id}
          // A container, so the badge moves by the list's width, not the window's.
          className="@container min-w-0 rounded-lg bg-card"
        >
          <button
            type="button"
            aria-label={[
              text.open(request.title),
              text.states[request.publicState],
              request.unread > 0 ? text.newReplies(request.unread) : null,
            ]
              .filter(Boolean)
              .join(", ")}
            onClick={() => onOpen(request)}
            className="flex w-full cursor-pointer items-center gap-1 rounded-lg pe-3 text-left"
          >
            <div className="min-w-0 flex-1">
              <ListRow
                unread={request.unread > 0}
                title={
                  <span className="block whitespace-normal break-words @md:truncate @md:whitespace-nowrap">
                    {request.title}
                  </span>
                }
                meta={
                  <span className="block whitespace-normal @md:truncate @md:whitespace-nowrap">
                    <span className="mb-1 block @md:hidden">
                      {stateBadge(request.publicState)}
                    </span>
                    {[
                      date.format(new Date(request.createdAt)),
                      request.type
                        ? messages.choices.type[
                            request.type as keyof typeof messages.choices.type
                          ]
                        : null,
                      request.impact
                        ? messages.choices.impact[
                            request.impact as keyof typeof messages.choices.impact
                          ]
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {request.unread > 0 ? (
                      <Badge variant="soft" tone="info" className="ms-2">
                        {text.newReplies(request.unread)}
                      </Badge>
                    ) : null}
                  </span>
                }
                badge={
                  <span className="hidden @md:inline-flex">
                    {stateBadge(request.publicState)}
                  </span>
                }
              />
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-muted-foreground"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}
