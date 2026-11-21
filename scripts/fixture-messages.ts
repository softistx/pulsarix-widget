/**
 * The API's own wording of the `intake.errors.*` codes the fixture refuses with, as the real
 * API sends it in `errors[0].message` (its catalogue: pulsarix-api `texts.intake.ts`).
 */
const TEXTS: Record<"en" | "fr", Record<string, string>> = {
  en: {
    unavailable: "Reports cannot be taken right now. Try again shortly.",
    "too-many-requests":
      "Too many requests. Try again in {minutes, plural, one {# minute} other {# minutes}}.",
    "identity-invalid":
      "Your identity could not be confirmed. Sign in again and retry.",
    "not-found": "This report does not exist.",
    "request-declined":
      "This request was declined: it can no longer be answered.",
    "reopen-expired":
      "This request was resolved too long ago to be reopened. Send a new request.",
    "ticket-invalid": "This upload is not allowed.",
  },
  fr: {
    unavailable:
      "Les signalements ne peuvent pas être pris pour le moment. Réessayez bientôt.",
    "too-many-requests":
      "Trop de requêtes. Réessayez dans {minutes, plural, one {# minute} other {# minutes}}.",
    "identity-invalid":
      "Votre identité n'a pas pu être confirmée. Reconnectez-vous et réessayez.",
    "not-found": "Ce signalement n'existe pas.",
    "request-declined":
      "Cette demande a été refusée : elle ne peut plus recevoir de réponse.",
    "reopen-expired":
      "Cette demande a été résolue il y a trop longtemps pour être rouverte. Envoyez une nouvelle demande.",
    "ticket-invalid": "Ce dépôt n'est pas autorisé.",
  },
};

/** The message for a code in the request's language (`accept-language`), minutes filled in. */
export function apiMessage(
  code: string,
  acceptLanguage: string | null,
  minutes?: number,
): string {
  const lang = acceptLanguage?.toLowerCase().startsWith("fr") ? "fr" : "en";
  const text = TEXTS[lang][code] ?? code;
  if (minutes === undefined) return text;
  return text.replace(
    /\{minutes, plural, one \{# minute\} other \{# minutes\}\}/,
    `${minutes} minute${minutes === 1 ? "" : "s"}`,
  );
}
