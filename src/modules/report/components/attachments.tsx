import {
  Alert,
  AttachmentList,
  Button,
  SwitchField,
} from "@softistx/material/embed";
import {
  DropOverlay,
  type DropRefusal,
  filterFiles,
} from "@softistx/material/files/drop";
import { I18nProvider } from "@softistx/material/i18n";
import { type Ref, useId, useRef } from "react";
import type { Locale } from "../../../config";
import type { Messages } from "../../../core/messages";
import type { Entry } from "../../files/hooks/use-attachments";
import { ACCEPTED_TYPES, MAX_FILE_BYTES } from "../../files/model/rules";
import { PaneStatus } from "../../screenshot/components/editor-host";

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

const canEdit = (e: Entry) => !e.refusal && e.file.type.startsWith("image/");

export interface AttachmentsControlProps {
  messages: Messages;
  locale: Locale;
  /** Where the capture hides the widget from (the host element is found from it). */
  region: Ref<HTMLDivElement>;
  /** The kept screenshot, then the chosen files, in one list. */
  items: Entry[];
  /** Nothing is added or removed while the report is on its way. */
  locked: boolean;
  /** The screenshot and the files together pass the report's total. */
  overTotal: boolean;
  /** The page can be captured (`getDisplayMedia`). */
  canCapture: boolean;
  busy: boolean;
  notice: string | null;
  maskText: boolean;
  onMaskText: (value: boolean) => void;
  onCapture: () => void;
  onDrop: (accepted: File[], refused: DropRefusal[]) => void;
  onRemove: (id: string) => void;
  /** Reopens an image in the editor. */
  onEdit: (id: string) => void;
}

/**
 * The report's attachments, one control: "Add a screenshot" (the page, annotated in the editor)
 * and "Upload an image" side by side, both feeding one list of removable thumbnails. Files can
 * also be dropped on it (`@softistx/material/files/drop`; the i18n provider gives the overlay
 * the widget's locale, `initialLanguage` keeps it from reading the host's `localStorage`).
 */
export function AttachmentsControl({
  messages,
  locale,
  region,
  items,
  locked,
  overTotal,
  canCapture,
  busy,
  notice,
  maskText,
  onMaskText,
  onCapture,
  onDrop,
  onRemove,
  onEdit,
}: AttachmentsControlProps) {
  const t = messages.screenshot;
  const label = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset cannot take programmatic focus after the editor closes without browser-specific layout quirks
    <div
      ref={region}
      tabIndex={-1}
      data-testid="attachments"
      role="group"
      aria-labelledby={label}
      className="grid gap-3 outline-none"
    >
      <p id={label} className="font-medium text-foreground text-sm">
        {messages.files.label}
      </p>
      <I18nProvider
        key={locale}
        initialLanguage={locale}
        supportedLanguages={["en", "fr"]}
        defaultLanguage={locale}
      >
        <DropOverlay
          disabled={locked}
          accept={ACCEPTED_TYPES}
          maxSize={MAX_FILE_BYTES}
          title={messages.files.dropTitle}
          description={messages.files.hint}
          onDrop={onDrop}
          className="grid gap-3"
        >
          <div className="flex flex-wrap gap-2">
            {canCapture ? (
              <Button
                type="button"
                variant="tonal"
                loading={busy}
                disabled={locked}
                onClick={onCapture}
              >
                {t.add}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="tonal"
              disabled={locked || busy}
              onClick={() => input.current?.click()}
            >
              {t.upload}
            </Button>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              accept={ACCEPTED_TYPES.join(",")}
              data-testid="attachments-input"
              onChange={(event) => {
                const files = [...(event.currentTarget.files ?? [])];
                event.currentTarget.value = "";
                // The same rules as a drop: a refused file is shown with its reason.
                if (files.length) {
                  const { accepted, refused } = filterFiles(files, {
                    accept: ACCEPTED_TYPES,
                    maxSize: MAX_FILE_BYTES,
                  });
                  onDrop(accepted, refused);
                }
              }}
            />
          </div>
          <p className="text-muted-foreground text-sm">{messages.files.hint}</p>
          {canCapture ? (
            <SwitchField
              variant="plain"
              checked={maskText}
              disabled={busy || locked}
              onCheckedChange={(checked) => onMaskText(checked === true)}
              label={t.maskText}
              helperText={t.maskTextHint}
            />
          ) : null}
          <PaneStatus messages={messages} busy={busy} notice={notice} />
          <AttachmentList
            items={items}
            onRemove={locked ? undefined : onRemove}
          />
          {items
            .filter((i) => i.pageUrl !== undefined || canEdit(i))
            .map((item) => (
              <div
                key={item.id}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 ps-1"
              >
                <p className="min-w-0 truncate text-muted-foreground text-sm">
                  {item.pageUrl ? t.capturedOn(item.pageUrl) : item.file.name}
                </p>
                {canEdit(item) ? (
                  <Button
                    type="button"
                    variant="tonal"
                    size="sm"
                    aria-label={editName(item, items, t)}
                    disabled={locked || busy}
                    onClick={() => onEdit(item.id)}
                  >
                    {t.edit}
                  </Button>
                ) : null}
              </div>
            ))}
          {overTotal ? (
            <Alert
              variant="warning"
              description={messages.files.totalBlocked}
            />
          ) : null}
        </DropOverlay>
      </I18nProvider>
    </div>
  );
}
