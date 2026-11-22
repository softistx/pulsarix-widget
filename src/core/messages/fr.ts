import type { Messages } from "./types";

/** The French words of the widget. */
export const FR: Messages = {
  launcher: "Signaler un problème",
  unreadReplies: (count) =>
    `${count} réponse${count === 1 ? "" : "s"} non lue${count === 1 ? "" : "s"}`,
  title: "Signaler un problème",
  intro: "Dites-nous ce qui ne va pas, nous allons regarder.",
  introFor: (project) =>
    `Dites-nous ce qui ne va pas dans ${project}, nous allons regarder.`,
  close: "Fermer",
  myRequests: "Mes demandes",
  cancel: "Annuler",
  screenshot: {
    add: "Ajouter une capture",
    upload: "Téléverser une image",
    maskText: "Masquer le texte de la page",
    maskTextHint:
      "Couvre chaque caractère de la page de rectangles noirs avant la capture.",
    capturing: "Capture en cours...",
    editorLabel: "Annoter la capture",
    edit: "Modifier",
    capturedOn: (url) => `Capturée sur ${url}`,
    save: "Joindre",
    loadingEditor: "Ouverture de l'éditeur...",
    errors: {
      denied:
        "La capture a été refusée. Vous pouvez téléverser une image à la place.",
      unavailable:
        "Ce navigateur ne peut pas capturer l'écran. Vous pouvez téléverser une image.",
      maskUnavailable:
        "Le masquage exige que cet onglet soit celui partagé. Partagez cet onglet, ou désactivez le masquage.",
      failed: "La capture a échoué. Réessayez, ou téléversez une image.",
    },
  },
  files: {
    label: "Pièces jointes (facultatif)",
    hint: "Une capture, plus 3 fichiers au plus : PNG, JPEG, WebP ou PDF, 5 Mo chacun.",
    dropTitle: "Déposez les fichiers à joindre",
    screenshot: "Capture d'écran",
    count: "Un signalement accepte 3 fichiers au plus.",
    total: "Ce fichier ferait dépasser 12 Mo au signalement.",
    totalBlocked:
      "La capture et les fichiers dépassent 12 Mo ensemble. Retirez-en un pour envoyer le signalement.",
    reasons: {
      type: "Refusé : utilisez un PNG, JPEG, WebP ou PDF.",
      size: "Trop volumineux : 5 Mo au plus.",
      unreadable: "Vide ou endommagé.",
      expired: "L'envoi a pris trop de temps.",
      busy: "Le service était occupé.",
      network: "La connexion a été coupée.",
      unknown: "Il n'a pas pu être envoyé.",
    },
  },
  fields: {
    title: "Titre",
    titleHint: "Un bref résumé",
    description: "Que s'est-il passé ?",
    descriptionHint: "Ce que vous avez fait et vu",
    email: "Votre e-mail (facultatif)",
    emailHint: "Ajoutez-le pour recevoir un lien de suivi",
    type: "Type (facultatif)",
    impact: "Gravité pour vous (facultatif)",
  },
  choices: {
    type: { bug: "Bug", question: "Question", suggestion: "Suggestion" },
    impact: { blocking: "Bloquant", annoying: "Gênant", minor: "Mineur" },
  },
  privacy:
    "Votre e-mail, s'il est donné, l'adresse de cette page et votre navigateur sont envoyés avec le signalement.",
  privacyLink: "Politique de confidentialité",
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
    config: "Ce formulaire est mal configuré. Prévenez le responsable du site.",
    unavailable: "Le service est occupé. Réessayez dans un instant.",
    rateLimited: (minutes) =>
      `Trop de signalements depuis ici. Réessayez dans ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    network:
      "Le serveur est injoignable. Vérifiez votre connexion, ou demandez au responsable du site si les signalements y sont activés.",
    unknown: "Une erreur est survenue. Réessayez dans un instant.",
  },
  done: {
    title: "Merci",
    body: "Votre signalement a été envoyé.",
    tracking: "Nous vous avons envoyé un lien pour le suivre.",
    noTracking: "Sans e-mail, il n'y a pas de lien de suivi.",
    attached: (count) =>
      count === 1
        ? "Votre fichier est joint."
        : `Vos ${count} fichiers sont joints.`,
    partialTitle: "Certains fichiers n'ont pas été joints",
    partial: (failed, total) =>
      `Votre signalement a été envoyé, mais ${failed} fichier${failed === 1 ? "" : "s"} sur ${total} n'${failed === 1 ? "a" : "ont"} pas pu être joint${failed === 1 ? "" : "s"}.`,
  },
};
