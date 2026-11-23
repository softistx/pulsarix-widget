import type { Locale } from "../../../config";
import type { PublicState, RequestFilter } from "../api";

/** The words of "My requests"; they ride in the lazy chunk, not in the main bundle. */
export interface RequestsMessages {
  description: string;
  filterLabel: string;
  filters: Record<RequestFilter, string>;
  states: Record<PublicState, string>;
  loading: string;
  /** No request at all: the first-use state. */
  none: { title: string; body: string; action: string };
  /** A filter with no request in it. */
  empty: Record<Exclude<RequestFilter, "ALL">, string>;
  newReplies: (count: number) => string;
  more: string;
  retry: string;
  /** Opening a request: its thread. */
  open: (title: string) => string;
  thread: {
    back: string;
    label: string;
    you: string;
    team: string;
    placeholder: string;
    send: string;
    attach: string;
    loading: string;
    resolve: string;
    reopen: string;
    resolvedNote: (date: string) => string;
    reopenExpired: string;
    declinedTitle: string;
    declinedNoReason: string;
    readOnly: string;
    attachments: string;
    needText: string;
    filesFailed: (names: string) => string;
    errors: {
      title: string;
      /** The client-side size check, before anything is sent. */
      files: string;
    };
  };
  /** The preferences view, opened from the list's header. */
  prefs: {
    title: string;
    open: string;
  };
  /** The e-mail choice and "Delete my data" (W3c). */
  privacy: {
    notificationsTitle: string;
    emails: string;
    emailsHint: string;
    emailsFailed: string;
    dataTitle: string;
    dataHint: string;
    erase: string;
    eraseTitle: string;
    eraseBody: string;
    eraseConfirm: string;
    eraseCancel: string;
    erased: (count: number) => string;
    eraseFailed: string;
  };
  errors: {
    title: string;
    identity: string;
    unavailable: string;
    rateLimited: (minutes: number) => string;
    network: string;
    unknown: string;
  };
}

export const REQUESTS_MESSAGES: Record<Locale, RequestsMessages> = {
  en: {
    description: "Follow what you reported and read the team's replies.",
    filterLabel: "Filter requests",
    filters: {
      OPEN: "Open",
      RESOLVED: "Resolved",
      DECLINED: "Declined",
      ALL: "All",
    },
    states: {
      received: "Received",
      inProgress: "In progress",
      resolved: "Resolved",
      declined: "Declined",
    },
    loading: "Loading your requests...",
    none: {
      title: "No requests yet",
      body: "What you report shows here, with the team's replies.",
      action: "New request",
    },
    empty: {
      OPEN: "No open requests.",
      RESOLVED: "No resolved requests.",
      DECLINED: "No declined requests.",
    },
    newReplies: (count) =>
      count === 1 ? "1 new reply" : `${count} new replies`,
    more: "Show more",
    retry: "Try again",
    open: (title) => `Open request: ${title}`,
    thread: {
      back: "Back",
      label: "Conversation",
      you: "You",
      team: "Team",
      placeholder: "Write a reply...",
      send: "Send",
      attach: "Attach files",
      loading: "Loading the conversation...",
      resolve: "Resolve",
      reopen: "Reopen",
      resolvedNote: (date) => `You marked this resolved on ${date}.`,
      reopenExpired:
        "This request was resolved more than 30 days ago and can no longer be reopened. Send a new request instead.",
      declinedTitle: "This request was declined",
      declinedNoReason: "The team gave no reason.",
      readOnly: "A declined request is read-only.",
      attachments: "Attachments",
      needText: "Write a message to go with your files.",
      filesFailed: (names) =>
        `Your reply was sent, but these files did not upload: ${names}.`,
      errors: {
        title: "That did not work",
        files:
          "A file was refused (PNG, JPEG, WebP or PDF, 5 MB each, 3 files).",
      },
    },
    prefs: { title: "Preferences", open: "Preferences" },
    privacy: {
      notificationsTitle: "Notifications",
      emails: "E-mails about my requests",
      emailsHint: "Get an e-mail when the team replies.",
      emailsFailed: "Your e-mail choice was not saved. Try again.",
      dataTitle: "Privacy",
      dataHint: "Erases every request you sent from this site.",
      erase: "Delete my data",
      eraseTitle: "Delete my data?",
      eraseBody:
        "Every request you sent from this site, with its replies and files, is erased for good. This cannot be undone.",
      eraseConfirm: "Delete",
      eraseCancel: "Cancel",
      erased: (count) =>
        count === 1 ? "1 request erased." : `${count} requests erased.`,
      eraseFailed: "Your data was not deleted. Try again.",
    },
    errors: {
      title: "Your requests could not be loaded",
      identity:
        "Your session expired. Reload the page and sign in again to see your requests.",
      unavailable: "The service is busy right now. Try again in a moment.",
      rateLimited: (minutes) =>
        `Too many requests from here. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      network: "Could not reach the server. Check your connection.",
      unknown: "Something went wrong. Try again in a moment.",
    },
  },
  fr: {
    description: "Suivez vos signalements et lisez les réponses de l'équipe.",
    filterLabel: "Filtrer les demandes",
    filters: {
      OPEN: "Ouvertes",
      RESOLVED: "Résolues",
      DECLINED: "Refusées",
      ALL: "Toutes",
    },
    states: {
      received: "Reçue",
      inProgress: "En cours",
      resolved: "Résolue",
      declined: "Refusée",
    },
    loading: "Chargement de vos demandes...",
    none: {
      title: "Aucune demande",
      body: "Ce que vous signalez s'affiche ici, avec les réponses de l'équipe.",
      action: "Nouvelle demande",
    },
    empty: {
      OPEN: "Aucune demande ouverte.",
      RESOLVED: "Aucune demande résolue.",
      DECLINED: "Aucune demande refusée.",
    },
    newReplies: (count) =>
      count === 1 ? "1 nouvelle réponse" : `${count} nouvelles réponses`,
    more: "Afficher plus",
    retry: "Réessayer",
    open: (title) => `Ouvrir la demande : ${title}`,
    thread: {
      back: "Retour",
      label: "Conversation",
      you: "Vous",
      team: "Équipe",
      placeholder: "Écrire une réponse...",
      send: "Envoyer",
      attach: "Joindre des fichiers",
      loading: "Chargement de la conversation...",
      resolve: "Résoudre",
      reopen: "Rouvrir",
      resolvedNote: (date) =>
        `Vous avez marqué cette demande comme résolue le ${date}.`,
      reopenExpired:
        "Cette demande est résolue depuis plus de 30 jours et ne peut plus être rouverte. Envoyez une nouvelle demande.",
      declinedTitle: "Cette demande a été refusée",
      declinedNoReason: "L'équipe n'a donné aucune raison.",
      readOnly: "Une demande refusée est en lecture seule.",
      attachments: "Pièces jointes",
      needText: "Écrivez un message pour accompagner vos fichiers.",
      filesFailed: (names) =>
        `Votre réponse est envoyée, mais ces fichiers n'ont pas été transférés : ${names}.`,
      errors: {
        title: "Cela n'a pas fonctionné",
        files:
          "Un fichier a été refusé (PNG, JPEG, WebP ou PDF, 5 Mo chacun, 3 fichiers).",
      },
    },
    prefs: { title: "Préférences", open: "Préférences" },
    privacy: {
      notificationsTitle: "Notifications",
      emails: "E-mails sur mes demandes",
      emailsHint: "Recevoir un e-mail quand l'équipe répond.",
      emailsFailed: "Votre choix n'a pas été enregistré. Réessayez.",
      dataTitle: "Confidentialité",
      dataHint: "Efface toutes les demandes envoyées depuis ce site.",
      erase: "Supprimer mes données",
      eraseTitle: "Supprimer mes données ?",
      eraseBody:
        "Toutes les demandes envoyées depuis ce site, avec leurs réponses et leurs fichiers, sont effacées définitivement. Cette action est irréversible.",
      eraseConfirm: "Supprimer",
      eraseCancel: "Annuler",
      erased: (count) =>
        count === 1 ? "1 demande effacée." : `${count} demandes effacées.`,
      eraseFailed: "Vos données n'ont pas été supprimées. Réessayez.",
    },
    errors: {
      title: "Vos demandes n'ont pas pu être chargées",
      identity:
        "Votre session a expiré. Rechargez la page et reconnectez-vous pour voir vos demandes.",
      unavailable: "Le service est occupé. Réessayez dans un instant.",
      rateLimited: (minutes) =>
        `Trop de requêtes depuis ici. Réessayez dans ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      network: "Le serveur est injoignable. Vérifiez votre connexion.",
      unknown: "Une erreur est survenue. Réessayez dans un instant.",
    },
  },
};
