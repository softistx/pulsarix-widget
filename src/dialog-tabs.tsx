import { Badge, Tabs, TabsList, TabsTrigger } from "@softistx/material/embed";
import type { Messages } from "./messages";

/** The identified reporter's two tabs; the unread count rides on "My requests". */
export function DialogTabs({
  messages,
  unread,
  value,
  onValueChange,
}: {
  messages: Messages;
  unread: number;
  value: "new" | "requests";
  onValueChange: (value: "new" | "requests") => void;
}) {
  // The root wraps the list only: a root around the dialog's parts would stop them being its grid items.
  return (
    <Tabs
      value={value}
      activationMode="manual"
      onValueChange={(next) =>
        onValueChange(next === "requests" ? "requests" : "new")
      }
    >
      <TabsList aria-label={messages.tabs.label}>
        <TabsTrigger value="new">{messages.tabs.newRequest}</TabsTrigger>
        <TabsTrigger value="requests">
          {messages.tabs.myRequests}
          {unread > 0 ? (
            <Badge size="sm" variant="error" className="ml-1.5">
              {unread > 99 ? "99+" : unread}
              <span className="sr-only"> {messages.unreadReplies(unread)}</span>
            </Badge>
          ) : null}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
