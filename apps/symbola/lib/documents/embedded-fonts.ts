// Lot 41 (FAC-10, D5, ADR 0079) — polices incorporées des factures et des avoirs : Liberation Sans
// et Liberation Serif 2.1.5 (licence SIL OFL 1.1, fichier LICENSE-Liberation.txt), mêmes largeurs
// de caractères que Helvetica et Times. Rangées dans le dépôt (lib/documents/fonts), copiées dans
// l'image par outputFileTracingIncludes (next.config.ts) ; le chemin part du dossier de l'app,
// dossier de travail du serveur, des tests et des scripts.
import { join } from "node:path";
import { Font } from "@react-pdf/renderer";

export const EMBEDDED_FONT_FILES = {
  LiberationSans: "LiberationSans-Regular.ttf",
  "LiberationSans-Bold": "LiberationSans-Bold.ttf",
  LiberationSerif: "LiberationSerif-Regular.ttf",
  "LiberationSerif-Bold": "LiberationSerif-Bold.ttf",
} as const;

export function embeddedFontsDir(): string {
  return join(process.cwd(), "lib", "documents", "fonts");
}

let registered = false;

export function registerEmbeddedFonts(): void {
  if (registered) return;
  for (const [family, file] of Object.entries(EMBEDDED_FONT_FILES)) Font.register({ family, src: join(embeddedFontsDir(), file) });
  registered = true;
}
