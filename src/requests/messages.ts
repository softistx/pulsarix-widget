import type { Locale } from "../config";
import type { PublicState, RequestFilter } from "./api";

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
  errors: {
    title: string;
    identity: string;
    unavailable: string;
    rateLimited: string;
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
    errors: {
      title: "Your requests could not be loaded",
      identity:
        "Your session expired. Reload the page and sign in again to see your requests.",
      unavailable: "The service is busy right now. Try again in a moment.",
      rateLimited: "Too many requests from here. Try again in a few minutes.",
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
    errors: {
      title: "Vos demandes n'ont pas pu être chargées",
      identity:
        "Votre session a expiré. Rechargez la page et reconnectez-vous pour voir vos demandes.",
      unavailable: "Le service est occupé. Réessayez dans un instant.",
      rateLimited:
        "Trop de requêtes depuis ici. Réessayez dans quelques minutes.",
      network: "Le serveur est injoignable. Vérifiez votre connexion.",
      unknown: "Une erreur est survenue. Réessayez dans un instant.",
    },
  },
};
