import { Alert, AttachmentList } from "@softistx/material/embed";
import { DropOverlay, type DropRefusal } from "@softistx/material/files/drop";
import { I18nProvider } from "@softistx/material/i18n";
import type { Locale } from "../config";
import type { Messages } from "../messages";
import { ACCEPTED_TYPES, MAX_FILE_BYTES } from "./rules";
import type { Entry } from "./use-attachments";

export interface AttachmentsSectionProps {
  messages: Messages;
  locale: Locale;
  entries: Entry[];
  /** The screenshot, shown as a read-only row while the files upload. */
  screenshot: Entry | null;
  /** Nothing is added or removed while the report is on its way. */
  locked: boolean;
  /** The screenshot and the files together pass the report's total. */
  overTotal: boolean;
  onDrop: (accepted: File[], refused: DropRefusal[]) => void;
  onRemove: (id: string) => void;
}

/**
 * The files of the report: a drop zone with Browse (`@softistx/material/files/drop`) and the
 * list of what was chosen (`AttachmentList`, from `/embed`). The i18n provider gives the drop
 * zone's own words the widget's locale; `initialLanguage` keeps it from reading the host page's
 * `localStorage`. `/embed` has its own i18n context, given the locale by `App`'s embed `I18nProvider`; every
 * refusal is worded here, in the widget's messages.
 */
export function AttachmentsSection({
  messages,
  locale,
  entries,
  screenshot,
  locked,
  overTotal,
  onDrop,
  onRemove,
}: AttachmentsSectionProps) {
  const t = messages.files;
  const items = [...(screenshot ? [screenshot] : []), ...entries];
  return (
    <div data-testid="attachments">
      <I18nProvider
        initialLanguage={locale}
        supportedLanguages={["en", "fr"]}
        defaultLanguage={locale}
      >
        <DropOverlay
          zone
          zoneLayout="full"
          disabled={locked}
          accept={ACCEPTED_TYPES}
          maxSize={MAX_FILE_BYTES}
          title={t.dropTitle}
          description={t.hint}
          zoneTitle={t.zoneTitle}
          browseLabel={t.browse}
          onDrop={onDrop}
          className="grid gap-3"
        >
          {items.length ? (
            <AttachmentList
              items={items}
              onRemove={locked ? undefined : onRemove}
              className="mt-3"
            />
          ) : null}
          {overTotal ? (
            <Alert variant="warning" description={t.totalBlocked} />
          ) : null}
        </DropOverlay>
      </I18nProvider>
    </div>
  );
}
