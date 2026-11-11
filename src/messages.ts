import type { Locale } from "./config";

export interface Messages {
  launcher: string;
  title: string;
  intro: string;
  close: string;
}

/** W0 carries the shell's few strings; the report form (W1) brings the rest. */
export const MESSAGES: Record<Locale, Messages> = {
  en: {
    launcher: "Report a problem",
    title: "Report a problem",
    intro: "Tell us what went wrong. The form arrives with the next release.",
    close: "Close",
  },
  fr: {
    launcher: "Signaler un problème",
    title: "Signaler un problème",
    intro:
      "Dites-nous ce qui ne va pas. Le formulaire arrive avec la prochaine version.",
    close: "Fermer",
  },
};
