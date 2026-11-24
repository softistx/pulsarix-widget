import { Button } from "@softistx/material/embed";
import type { Messages } from "../../../core/messages";
import type { Entry } from "../../files/hooks/use-attachments";

/** "Edit capture 2" for a capture (its place among the captures), the file's name otherwise. */
function editName(
  item: Entry,
  items: Entry[],
  t: Messages["screenshot"],
): string {
  if (item.pageUrl === undefined) return `${t.edit} ${item.file.name}`;
  const n = items.filter((i) => i.pageUrl !== undefined).indexOf(item) + 1;
  return t.editCapture(n);
}

export const canEdit = (e: Entry) =>
  !e.refusal && e.file.type.startsWith("image/");

/** The caption ("Captured on ...") and the Edit button of each image or capture, under the list. */
export function EditRows({
  messages,
  items,
  all,
  disabled,
  onEdit,
}: {
  messages: Messages;
  items: Entry[];
  all: Entry[];
  disabled: boolean;
  onEdit: (id: string) => void;
}) {
  const t = messages.screenshot;
  if (disabled) return null;
  // Temporary, until material#5573 (per-row actions and a caption in AttachmentList):
  // the caption and the Edit button sit under the list meanwhile.
  return items
    .filter((i) => i.pageUrl !== undefined || canEdit(i))
    .map((item) => (
      <div
        key={item.id}
        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
      >
        <p className="min-w-0 truncate text-muted-foreground text-sm">
          {item.pageUrl ? t.capturedOn(item.pageUrl) : item.file.name}
        </p>
        {canEdit(item) ? (
          <Button
            type="button"
            variant="tonal"
            size="sm"
            aria-label={editName(item, all, t)}
            disabled={disabled}
            onClick={() => onEdit(item.id)}
          >
            {t.edit}
          </Button>
        ) : null}
      </div>
    ));
}
