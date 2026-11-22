import type { Messages } from "./types";

/** The English words of the widget. */
export const EN: Messages = {
  launcher: "Report a problem",
  title: "Report a problem",
  intro: "Tell us what went wrong and we will look into it.",
  introFor: (project) =>
    `Tell us what went wrong in ${project} and we will look into it.`,
  close: "Close",
  myRequests: "My requests",
  cancel: "Cancel",
  screenshot: {
    add: "Add a screenshot",
    upload: "Upload an image",
    maskText: "Mask the text on the page",
    maskTextHint:
      "Covers every character of the page with black boxes before the picture is taken.",
    capturing: "Taking the screenshot...",
    editorLabel: "Annotate the screenshot",
    edit: "Edit",
    editCapture: (n) => `Edit capture ${n}`,
    capturedOn: (url) => `Captured on ${url}`,
    save: "Attach",
    loadingEditor: "Opening the editor...",
    errors: {
      denied: "The capture was refused. You can upload an image instead.",
      unavailable:
        "This browser cannot capture the screen. You can upload an image instead.",
      maskUnavailable:
        "Masking needs this tab to be the one shared. Share this tab, or turn masking off.",
      failed:
        "The screenshot could not be taken. Try again, or upload an image.",
    },
  },
  files: {
    label: "Attachments (optional)",
    hint: "A screenshot, plus up to 3 files: PNG, JPEG, WebP or PDF, 5 MB each.",
    dropTitle: "Drop files to attach",
    screenshot: "Screenshot",
    count: "A report takes 3 files at most.",
    total: "This file would take the report past 12 MB.",
    totalBlocked:
      "The screenshot and the files together pass 12 MB. Remove one to send the report.",
    reasons: {
      type: "Not accepted: use a PNG, JPEG, WebP or PDF.",
      size: "Too large: 5 MB at most.",
      unreadable: "Empty or damaged.",
      expired: "Took too long to send.",
      busy: "The service was busy.",
      network: "The connection dropped.",
      unknown: "It could not be sent.",
    },
  },
  fields: {
    title: "Title",
    titleHint: "A short summary",
    description: "What happened?",
    descriptionHint: "What you did and saw",
    email: "Your e-mail (optional)",
    emailHint: "To get a link to your report",
    type: "Type (optional)",
    impact: "How much it blocks you (optional)",
  },
  choices: {
    type: { bug: "Bug", question: "Question", suggestion: "Suggestion" },
    impact: { blocking: "Blocking", annoying: "Annoying", minor: "Minor" },
  },
  privacy:
    "Your e-mail, if given, the address of this page and your browser are sent with the report.",
  privacyLink: "Privacy policy",
  submit: "Send",
  submitting: "Sending...",
  errors: {
    titleRequired: "Enter a title.",
    titleTooLong: "The title is too long (200 characters at most).",
    descriptionRequired: "Describe the problem.",
    descriptionTooLong:
      "The description is too long (10,000 characters at most).",
    emailInvalid: "Enter a valid e-mail address, or leave it empty.",
  },
  failure: {
    summary: "Your report was not sent",
    config: "This form is not set up correctly. Tell the owner of this site.",
    unavailable: "The service is busy right now. Try again in a moment.",
    rateLimited: (minutes) =>
      `Too many reports from here. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    network:
      "Could not reach the server. Check your connection, or ask the site owner whether reports are enabled here.",
    unknown: "Something went wrong. Try again in a moment.",
  },
  done: {
    title: "Thank you",
    body: "Your report was sent.",
    tracking: "We e-mailed you a link to follow it.",
    noTracking: "You gave no e-mail, so there is no link to follow it.",
    attached: (count) =>
      count === 1
        ? "Your file is attached."
        : `Your ${count} files are attached.`,
    partialTitle: "Some files were not attached",
    partial: (failed, total) =>
      `Your report was sent, but ${failed} of ${total} ${total === 1 ? "file" : "files"} could not be attached.`,
  },
};
