import type { Locale } from "./config";

export interface Messages {
  launcher: string;
  title: string;
  intro: string;
  close: string;
  fields: {
    title: string;
    titleHint: string;
    description: string;
    descriptionHint: string;
    email: string;
    emailHint: string;
  };
  privacy: string;
  submit: string;
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
    unavailable: string;
    rateLimited: (minutes: number) => string;
    invalid: string;
    network: string;
    unknown: string;
  };
  done: {
    title: string;
    body: string;
    tracking: string;
    noTracking: string;
  };
}

export const MESSAGES: Record<Locale, Messages> = {
  en: {
    launcher: "Report a problem",
    title: "Report a problem",
    intro: "Tell us what went wrong and we will look into it.",
    close: "Close",
    fields: {
      title: "Title",
      titleHint: "A short summary",
      description: "What happened?",
      descriptionHint: "What you did and saw",
      email: "Your e-mail (optional)",
      emailHint: "To get a link to your report",
    },
    privacy:
      "Your e-mail, if given, the address of this page and your browser are sent with the report.",
    submit: "Send report",
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
      rejected:
        "This form cannot take reports from this site. Tell the owner of this site.",
      unavailable: "The service is busy right now. Try again in a moment.",
      rateLimited: (minutes) =>
        `Too many reports from here. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      invalid: "The report was refused. Check what you wrote and try again.",
      network:
        "Could not reach the server. Check your connection, or ask the site owner whether reports are enabled here.",
      unknown: "Something went wrong. Try again in a moment.",
    },
    done: {
      title: "Thank you",
      body: "Your report was sent.",
      tracking: "We e-mailed you a link to follow it.",
      noTracking: "You gave no e-mail, so there is no link to follow it.",
    },
  },
  fr: {
    launcher: "Signaler un problème",
    title: "Signaler un problème",
    intro: "Dites-nous ce qui ne va pas, nous allons regarder.",
    close: "Fermer",
    fields: {
      title: "Titre",
      titleHint: "Un bref résumé",
      description: "Que s'est-il passé ?",
      descriptionHint: "Ce que vous avez fait et vu",
      email: "Votre e-mail (facultatif)",
      emailHint: "Ajoutez-le pour recevoir un lien de suivi",
    },
    privacy:
      "Votre e-mail, s'il est donné, l'adresse de cette page et votre navigateur sont envoyés avec le signalement.",
    submit: "Envoyer",
    submitting: "Envoi...",
    errors: {
      titleRequired: "Saisissez un titre.",
      titleTooLong: "Le titre est trop long (200 caractères au plus).",
      descriptionRequired: "Décrivez le problème.",
      descriptionTooLong:
        "La description est trop longue (10 000 caractères au plus).",
      emailInvalid: "Saisissez une adresse e-mail valide, ou laissez vide.",
    },
    failure: {
      summary: "Votre signalement n'a pas été envoyé",
      config:
        "Ce formulaire est mal configuré. Prévenez le responsable du site.",
      rejected:
        "Ce formulaire n'accepte pas de signalements depuis ce site. Prévenez le responsable du site.",
      unavailable: "Le service est occupé. Réessayez dans un instant.",
      rateLimited: (minutes) =>
        `Trop de signalements depuis ici. Réessayez dans ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      invalid:
        "Le signalement a été refusé. Vérifiez votre texte et réessayez.",
      network:
        "Le serveur est injoignable. Vérifiez votre connexion, ou demandez au responsable du site si les signalements y sont activés.",
      unknown: "Une erreur est survenue. Réessayez dans un instant.",
    },
    done: {
      title: "Merci",
      body: "Votre signalement a été envoyé.",
      tracking: "Nous vous avons envoyé un lien pour le suivre.",
      noTracking: "Sans e-mail, il n'y a pas de lien de suivi.",
    },
  },
};
