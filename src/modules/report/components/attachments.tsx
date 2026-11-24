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
import { EditRows } from "./edit-rows";
import { FormGroup } from "./fields";

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
 * The report's attachments, in two titled sections: "Screenshot" (the capture, its mask switch
 * and its kept pictures) and "Attachments" (the drop zone of `@softistx/material/files/drop` and
 * the uploaded files). Files can also be dropped on the attachments section (the i18n provider
 * gives the overlay the widget's locale, `initialLanguage` keeps it from reading the host's
 * `localStorage`).
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
  const captureTitle = useId();
  const filesTitle = useId();
  const input = useRef<HTMLInputElement>(null);
  const captures = items.filter((i) => i.pageUrl !== undefined);
  const uploads = items.filter((i) => i.pageUrl === undefined);
  const remove = locked ? undefined : onRemove;
  return (
    <div
      ref={region}
      tabIndex={-1}
      data-testid="attachments"
      className="grid gap-6 outline-none"
    >
      {canCapture || captures.length > 0 ? (
        <FormGroup
          title={t.sectionTitle}
          hint={t.sectionHint}
          titleId={captureTitle}
          data-testid="capture-section"
        >
          <div className="grid justify-items-start gap-3">
            <Button
              type="button"
              variant="tonal"
              disabled={locked || busy}
              onClick={onCapture}
            >
              {t.add}
            </Button>
            <SwitchField
              variant="plain"
              checked={maskText}
              disabled={busy || locked}
              onCheckedChange={(checked) => onMaskText(checked === true)}
              label={t.maskText}
              helperText={t.maskTextHint}
            />
          </div>
          <PaneStatus messages={messages} busy={busy} notice={notice} />
          <AttachmentList items={captures} onRemove={remove} />
          <EditRows
            messages={messages}
            items={captures}
            all={items}
            disabled={locked || busy}
            onEdit={onEdit}
          />
        </FormGroup>
      ) : null}
      <FormGroup
        title={messages.files.label}
        hint={messages.files.sectionHint}
        titleId={filesTitle}
        role="group"
      >
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
            zone
            zoneLayout="inline"
            zoneTitle={messages.files.dropTitle}
            browseLabel={t.upload}
            className="grid gap-3"
          >
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
            {!canCapture ? (
              <PaneStatus messages={messages} busy={busy} notice={notice} />
            ) : null}
            <AttachmentList items={uploads} onRemove={remove} />
            <EditRows
              messages={messages}
              items={uploads}
              all={items}
              disabled={locked || busy}
              onEdit={onEdit}
            />
            {overTotal ? (
              <Alert
                variant="warning"
                description={messages.files.totalBlocked}
              />
            ) : null}
          </DropOverlay>
        </I18nProvider>
      </FormGroup>
    </div>
  );
}
