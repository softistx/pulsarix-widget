import type { Locale } from "../../config";
import { EN } from "./en";
import { FR } from "./fr";
import type { Messages } from "./types";

export type { Messages } from "./types";

export const MESSAGES: Record<Locale, Messages> = { en: EN, fr: FR };
