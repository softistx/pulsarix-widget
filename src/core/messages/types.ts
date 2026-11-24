export interface Messages {
  launcher: string;
  /** The launcher's accessible name with its unread count: "Report a problem, 2 unread requests". */
  launcherUnread: (count: number) => string;
  /** The tooltip's second line, and the launcher's description for assistive technology. */
  launcherHint: string;
  /** The keyboard way to move the launcher, shown in the tooltip on keyboard focus and read as a description. */
  launcherKeyHint: string;
  /** Announced after the reporter moves the launcher: "Position: 45 %". */
  launcherMoved: (percent: number) => string;
  title: string;
  intro: string;
  /** The intro once the project's name is known. */
  introFor: (project: string) => string;
  close: string;
  /** The title of the identified reporter's own view. */
  myRequests: string;
  /** The report dialog's Cancel. */
  cancel: string;
  screenshot: {
    /** The one attachments button, which offers the capture and the upload. */
    attach: string;
    add: string;
    upload: string;
    maskText: string;
    maskTextHint: string;
    capturing: string;
    noticeTitle: string;
    editorLabel: string;
    /** The button that reopens an attachment in the editor. */
    edit: string;
    editCapture: (n: number) => string;
    /** The page a capture was taken on (origin and path). */
    capturedOn: (url: string) => string;
    save: string;
    loadingEditor: string;
    errors: {
      denied: string;
      unavailable: string;
      maskUnavailable: string;
      failed: string;
    };
  };
  files: {
    label: string;
    hint: string;
    dropTitle: string;
    screenshot: string;
    count: string;
    total: string;
    totalBlocked: string;
    /** Why one file did not reach the API. */
    reasons: {
      type: string;
      size: string;
      unreadable: string;
      expired: string;
      busy: string;
      network: string;
      unknown: string;
    };
  };
  fields: {
    title: string;
    titleHint: string;
    description: string;
    descriptionHint: string;
    email: string;
    emailHint: string;
    type: string;
    impact: string;
  };
  /** The optional chips of the form (`type`, `impact`). */
  choices: {
    type: { bug: string; question: string; suggestion: string };
    impact: { blocking: string; annoying: string; minor: string };
  };
  privacy: string;
  /** The link text to the integrator's privacy page. */
  privacyLink: string;
  submit: string;
  /** @deprecated Unused since material 3.239: the busy submit button keeps its label. */
  submitting: string;
  errors: {
    titleRequired: string;
    titleTooLong: string;
    descriptionRequired: string;
    descriptionTooLong: string;
    emailInvalid: string;
  };
  failure: {
    summary: string;
    retry: string;
    config: string;
    unavailable: string;
    rateLimited: (minutes: number) => string;
    network: string;
    unknown: string;
  };
  done: {
    title: string;
    body: string;
    tracking: string;
    noTracking: string;
    attached: (count: number) => string;
    partialTitle: string;
    partial: (failed: number, total: number) => string;
  };
}
