export interface Messages {
  launcher: string;
  /** The launcher's accessible addition while replies wait: "3 unread replies". */
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
    /** The "Add" of the reporter's thread composer. */
    attach: string;
    /** The capture section's title and its one line. */
    sectionTitle: string;
    sectionHint: string;
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
    /** The attachments section's one line. */
    sectionHint: string;
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
    /** The title of the last section, which holds the e-mail. */
    contact: string;
    type: string;
    impact: string;
  };
  /** The optional chips of the form (`type`, `impact`). */
  choices: {
    type: { bug: string; question: string; suggestion: string };
    impact: { blocking: string; annoying: string; minor: string };
  };
  /** The one-line description under each choice card. */
  choiceHints: {
    type: { bug: string; question: string; suggestion: string };
    impact: { blocking: string; annoying: string; minor: string };
  };
  /** What is sent with a report (shown to an anonymous reporter). */
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
