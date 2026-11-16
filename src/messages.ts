import type { Locale } from "./config";

export interface Messages {
  launcher: string;
  title: string;
  intro: string;
  /** The intro once the project's name is known. */
  introFor: (project: string) => string;
  close: string;
  sections: { problem: string; files: string; contact: string };
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

export const MESSAGES: Record<Locale, Messages> = {
  en: {
    launcher: "Report a problem",
    title: "Report a problem",
    intro: "Tell us what went wrong and we will look into it.",
    introFor: (project) =>
      `Tell us what went wrong in ${project} and we will look into it.`,
    close: "Close",
    sections: { problem: "The problem", files: "Files", contact: "Follow-up" },
    aside: {
      title: "Screenshot",
      empty: "A screenshot of the page will show here.",
    },
    screenshot: {
      add: "Add a screenshot",
      upload: "Upload an image",
      retake: "Retake",
      remove: "Remove",
      maskText: "Mask the text on the page",
      maskTextHint:
        "Covers every character of the page with black boxes before the picture is taken.",
      capturing: "Taking the screenshot...",
      editorLabel: "Annotate the screenshot",
      previewAlt: "Your screenshot",
      saved: "Your screenshot is attached.",
      hint: "Optional. You can draw on it and hide anything private before it is sent.",
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
        type: "Choose a PNG, JPEG or WebP image.",
        tooLarge: "This image is too large (25 megapixels at most).",
        unreadable: "This image could not be read.",
      },
    },
    files: {
      hint: "Optional. Up to 3 files: PNG, JPEG, WebP or PDF, 5 MB each.",
      dropTitle: "Drop files to attach",
      zoneTitle: "Drag files here",
      browse: "Browse",
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
      files:
        "Your files were refused. Remove them, or check they are PNG, JPEG, WebP or PDF files under 5 MB, and try again.",
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
  },
  fr: {
    launcher: "Signaler un problème",
    title: "Signaler un problème",
    intro: "Dites-nous ce qui ne va pas, nous allons regarder.",
    introFor: (project) =>
      `Dites-nous ce qui ne va pas dans ${project}, nous allons regarder.`,
    close: "Fermer",
    sections: { problem: "Le problème", files: "Fichiers", contact: "Suivi" },
    aside: {
      title: "Capture d'écran",
      empty: "Une capture d'écran de la page s'affichera ici.",
    },
    screenshot: {
      add: "Ajouter une capture",
      upload: "Téléverser une image",
      retake: "Reprendre",
      remove: "Retirer",
      maskText: "Masquer le texte de la page",
      maskTextHint:
        "Couvre chaque caractère de la page de rectangles noirs avant la capture.",
      capturing: "Capture en cours...",
      editorLabel: "Annoter la capture",
      previewAlt: "Votre capture d'écran",
      saved: "Votre capture est jointe.",
      hint: "Facultatif. Vous pouvez dessiner dessus et masquer ce qui est privé avant l'envoi.",
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
        type: "Choisissez une image PNG, JPEG ou WebP.",
        tooLarge: "Cette image est trop grande (25 mégapixels au plus).",
        unreadable: "Cette image n'a pas pu être lue.",
      },
    },
    files: {
      hint: "Facultatif. 3 fichiers au plus : PNG, JPEG, WebP ou PDF, 5 Mo chacun.",
      dropTitle: "Déposez les fichiers à joindre",
      zoneTitle: "Glissez des fichiers ici",
      browse: "Parcourir",
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
      files:
        "Vos fichiers ont été refusés. Retirez-les, ou vérifiez que ce sont des PNG, JPEG, WebP ou PDF de moins de 5 Mo, puis réessayez.",
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
  },
};
