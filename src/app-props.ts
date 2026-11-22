import type { LauncherMode, Locale, MetadataEntry, Position } from "./config";
import type { Messages } from "./core/messages";
import type { SubmitDetail } from "./modules/report/components/report-flow";

export interface AppProps {
  /** The `data-nxgt-theme` scope the adopted theme CSS is declared under. */
  themeName?: string;
  /** Custom properties inherited from the host's theme, set on the root over the theme's own. */
  hostTokens?: Record<string, string>;
  messages: Messages;
  locale: Locale;
  projectKey: string | null;
  apiBase: string | null;
  dark: boolean;
  open: boolean;
  launcher: boolean;
  /** Read for compatibility: every value (`auto`, `pill`, `icon`) is the round FAB. */
  launcherMode?: LauncherMode;
  /** `setLauncherVisible(false)` hides the launcher only, never an open dialog. */
  launcherVisible?: boolean;
  position: Position;
  /** The screenshot's mask-text option starts on. */
  maskText?: boolean;
  /** `data-attachments="false"` hides the screenshot pane and the files. */
  attachments?: boolean;
  /** Starting values of the form (`prefill-email`, `prefill-title`). */
  prefill?: { email: string; title: string };
  /** Flat strings stored with each report. */
  metadata?: MetadataEntry[];
  /** The integrator's privacy page, linked in the privacy line. */
  privacyUrl?: string | null;
  /** The host's signed identity token; with it the FAB opens a menu: report a problem, or My requests (one view each, no tabs). */
  identity?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (detail: SubmitDetail) => void;
  /** A team reply arrived (`pulsarix:reply`), heard while a thread is open. */
  onReply?: (detail: { requestId: string }) => void;
  /** "Delete my data" erased the reporter's requests (`pulsarix:erase`). */
  onErase?: (detail: { requests: number }) => void;
  /** The unread count changed (`pulsarix:unread`). */
  onUnreadChange?: (detail: { count: number }) => void;
  onError: (detail: { code: string }) => void;
  /** Specs only: the API's minimum fill time is waited out otherwise. */
  minFillMs?: number;
  /** Specs only: the wait before an upload's one retry. */
  retryDelayMs?: number;
}
