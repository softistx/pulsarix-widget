import {
  Alert,
  AttachmentList,
  Button,
  FormCell,
  Icon,
  SwitchField,
} from "@softistx/material/embed";
import {
  DropOverlay,
  type DropRefusal,
  filterFiles,
} from "@softistx/material/files/drop";
import { I18nProvider } from "@softistx/material/i18n";
import { type Ref, useEffect, useRef } from "react";
import type { Locale } from "../../../config";
import type { Messages } from "../../../core/messages";
import type { Entry } from "../../files/hooks/use-attachments";
import { ACCEPTED_TYPES, MAX_FILE_BYTES } from "../../files/model/rules";
import { PaneStatus } from "../../screenshot/components/editor-host";
import { EditRows } from "./edit-rows";
import { Section } from "./fields";

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
/**
 * One AttachmentList and its own caption + Edit row per item, so the Edit sits under its own file.
 * Temporary, until @softistx/material#5573 (per-row actions and a caption in AttachmentList).
 */
function ItemRows({
  messages,
  items,
  all,
  disabled,
  onRemove,
  onEdit,
}: {
  messages: Messages;
  items: Entry[];
  all: Entry[];
  disabled: boolean;
  onRemove?: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  return items.map((item) => (
    <div key={item.id} className="grid gap-1">
      <AttachmentList items={[item]} onRemove={onRemove} thumbnailSize={56} />
      <EditRows
        messages={messages}
        items={[item]}
        all={all}
        disabled={disabled}
        onEdit={onEdit}
      />
    </div>
  ));
}

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
  const input = useRef<HTMLInputElement>(null);
  const captures = items.filter((i) => i.pageUrl !== undefined);
  const uploads = items.filter((i) => i.pageUrl === undefined);
  const remove = locked ? undefined : onRemove;
  const uploadList = useRef<HTMLDivElement>(null);
  const scrollToRefused = useRef(false);
  const drop = (accepted: File[], refused: DropRefusal[]) => {
    scrollToRefused.current = refused.length > 0;
    onDrop(accepted, refused);
  };
  // A refused file is shown with its reason: bring the first one into view.
  useEffect(() => {
    if (!scrollToRefused.current) return;
    scrollToRefused.current = false;
    const reason = items.find((i) => i.refusal)?.refusal;
    if (!reason) return;
    const row = [...(uploadList.current?.querySelectorAll("*") ?? [])].find(
      (el) => el.textContent === reason,
    );
    row?.scrollIntoView?.({ block: "nearest" });
  }, [items]);
  return (
    // Fragment: the sections stay direct children of the form's grid, so the rule between two
    // sections is drawn. The focus target is the first section shown.
    <>
      {canCapture || captures.length > 0 ? (
        <Section
          title={t.sectionTitle}
          description={t.sectionHint}
          data-testid="capture-section"
          ref={region}
          tabIndex={-1}
          body="stack"
          className="outline-none"
        >
          <FormCell span="full">
            <div className="grid justify-items-start gap-3">
              <SwitchField
                variant="plain"
                checked={maskText}
                disabled={busy || locked}
                onCheckedChange={(checked) => onMaskText(checked === true)}
                label={t.maskText}
                helperText={t.maskTextHint}
              />
              <Button
                type="button"
                variant="tonal"
                disabled={locked || busy}
                onClick={onCapture}
              >
                <Icon name="camera" aria-hidden="true" />
                {t.add}
              </Button>
            </div>
          </FormCell>
          <PaneStatus messages={messages} busy={busy} notice={notice} />
          {captures.length > 0 ? (
            <div className="grid gap-4">
              <ItemRows
                messages={messages}
                items={captures}
                all={items}
                disabled={locked || busy}
                onRemove={remove}
                onEdit={onEdit}
              />
            </div>
          ) : null}
        </Section>
      ) : null}
      <Section
        title={messages.files.label}
        description={messages.files.sectionHint}
        role="group"
        data-testid="files-section"
        body="stack"
        ref={canCapture || captures.length > 0 ? undefined : region}
        tabIndex={canCapture || captures.length > 0 ? undefined : -1}
        className="outline-none"
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
            onDrop={drop}
            zone
            zoneLayout="full"
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
                  drop(accepted, refused);
                }
              }}
            />
            {!canCapture ? (
              <PaneStatus messages={messages} busy={busy} notice={notice} />
            ) : null}
            <div ref={uploadList} className="grid gap-4">
              <ItemRows
                messages={messages}
                items={uploads}
                all={items}
                disabled={locked || busy}
                onRemove={remove}
                onEdit={onEdit}
              />
            </div>
            {overTotal ? (
              <Alert
                variant="warning"
                description={messages.files.totalBlocked}
              />
            ) : null}
          </DropOverlay>
        </I18nProvider>
      </Section>
    </>
  );
}
