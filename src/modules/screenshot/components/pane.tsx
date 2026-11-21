import type { ReactNode } from "react";
import type { Messages } from "../../../core/messages";
import { ACCEPTED, usePane } from "../hooks/use-pane";
import { EditorHost, EmptyView, PaneStatus, SavedView } from "./pane-parts";

export interface ScreenshotPaneProps {
  messages: Messages;
  /** The flattened export that is kept, or null. The raw capture is never held outside the pane. */
  image: File | null;
  onImage: (image: File | null) => void;
  /** The mask-text option starts on (`data-mask-text="true"`). */
  maskTextDefault?: boolean;
  /** Told when the editor opens or closes: the dialog widens its pane while it is open. */
  onEditingChange?: (editing: boolean) => void;
}

/**
 * The right pane of the split dialog: choose a picture (screen capture, or an uploaded
 * image), annotate it in the lazy editor, and keep only the flattened export. Retake and
 * remove drop it again. A report is complete without any of this.
 */
export function ScreenshotPane({
  messages,
  image,
  onImage,
  maskTextDefault = false,
  onEditingChange,
}: ScreenshotPaneProps) {
  const pane = usePane(messages, maskTextDefault, onEditingChange);
  const status = (
    <PaneStatus messages={messages} busy={pane.busy} notice={pane.notice} />
  );

  let body: ReactNode;
  if (pane.source) {
    body = (
      <EditorHost
        messages={messages}
        source={pane.source}
        onSave={(file) => {
          pane.setSource(null);
          onImage(file);
          pane.focusRegion();
        }}
        onCancel={() => {
          pane.setSource(null);
          pane.focusRegion();
        }}
      />
    );
  } else if (image) {
    body = (
      <SavedView
        messages={messages}
        image={image}
        busy={pane.busy}
        status={status}
        onRetake={() => void pane.again()}
        onRemove={() => {
          onImage(null);
          pane.setNotice(null);
          pane.focusRegion();
        }}
      />
    );
  } else {
    body = (
      <EmptyView
        messages={messages}
        canCapture={pane.canCapture}
        busy={pane.busy}
        maskText={pane.maskText}
        onMaskText={pane.setMaskText}
        onCapture={() => void pane.capture()}
        onPick={pane.pickFile}
        status={status}
      />
    );
  }

  return (
    <div
      ref={pane.region}
      tabIndex={-1}
      className="min-h-0 outline-none md:h-full"
      data-testid="screenshot-pane"
    >
      {body}
      <input
        ref={pane.fileInput}
        type="file"
        accept={ACCEPTED.join(",")}
        hidden
        data-testid="screenshot-file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void pane.upload(file);
        }}
      />
    </div>
  );
}
