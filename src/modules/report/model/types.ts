import type { ReactNode } from "react";
import type { Locale, MetadataEntry } from "../../../config";
import type { Messages } from "../../../core/messages";
import type { WidgetProject } from "../api";
import type { ReportValues } from "./validation";

/** The API refuses a report sent faster than this after the form opened (`MIN_FILL_MS`). */
export const MIN_FILL_MS = 3_000;

/** What `pulsarix:submit` carries: the report, and what became of each file. */
export interface SubmitDetail {
  reportId: string;
  files: {
    name: string;
    role: "screenshot" | "file";
    type: string;
    size: number;
    uploaded: boolean;
  }[];
}

export interface ReportFlowProps {
  messages: Messages;
  locale: Locale;
  projectKey: string | null;
  apiBase: string | null;
  onSubmitted: (detail: SubmitDetail) => void;
  onError: (detail: { code: string }) => void;
  onClose: () => void;
  /** Told when the confirmation shows (no screenshot pane, so the dialog is not split). */
  onDone?: (done: boolean) => void;
  /** A report is on its way (the fill-time wait, the request and the uploads). */
  onSubmitting?: (submitting: boolean) => void;
  /** Told when the screenshot editor opens or closes (the dialog widens its pane). */
  onEditing?: (editing: boolean) => void;
  /** Overridable for specs; the API's own minimum otherwise. */
  minFillMs?: number;
  /** The screenshot's mask-text option starts on (`data-mask-text="true"`). */
  maskText?: boolean;
  /** `data-attachments="false"` turns the screenshot and file controls off. */
  attachments?: boolean;
  /** Told whether the controls show (the key's own switch is known once its config is read). */
  onControls?: (shown: boolean) => void;
  /** Wait before an upload's one retry; specs shorten it. */
  retryDelayMs?: number;
  /** Starting values of the form, used when there is no kept draft. */
  prefill?: { email: string; title: string };
  /** Flat strings stored with the report. */
  metadata?: MetadataEntry[];
  /** The integrator's privacy page, linked in the privacy line. */
  privacyUrl?: string | null;
  /**
   * What was typed, kept by the owner of the dialog: closing the dialog unmounts the flow, and
   * a close by accident must not lose the text. Cleared once the report is sent.
   */
  draft?: { current: ReportValues | null };
  /** The host's identity token: the report is the reporter's own and shows in My requests. */
  identity?: string | null;
  /** Rendered in the dialog's header, under the description (the identified reporter's tabs). */
  headerExtra?: ReactNode;
  /** The key's project, when the owner of the dialog already read it (a tab switch remounts this). */
  project?: WidgetProject | null;
  onProject?: (project: WidgetProject | null) => void;
}
