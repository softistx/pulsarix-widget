export interface Messages {
  launcher: string;
  /** The launcher's accessible addition while replies wait: "3 unread replies". */
  unreadReplies: (count: number) => string;
  title: string;
  intro: string;
  /** The intro once the project's name is known. */
  introFor: (project: string) => string;
  close: string;
  sections: {
    problem: string;
    details: string;
    files: string;
    contact: string;
  };
  /** The two tabs of an identified reporter. */
  tabs: { label: string; newRequest: string; myRequests: string };
  aside: { title: string; empty: string };
  screenshot: {
    add: string;
    upload: string;
    retake: string;
    remove: string;
    maskText: string;
    maskTextHint: string;
    capturing: string;
    editorLabel: string;
    previewAlt: string;
    saved: string;
    hint: string;
    save: string;
    loadingEditor: string;
    errors: {
      denied: string;
      unavailable: string;
      maskUnavailable: string;
      failed: string;
      type: string;
      tooLarge: string;
      unreadable: string;
    };
  };
  files: {
    hint: string;
    dropTitle: string;
    zoneTitle: string;
    browse: string;
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
    config: string;
    rejected: string;
    identity: string;
    unavailable: string;
    rateLimited: (minutes: number) => string;
    invalid: string;
    files: string;
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
