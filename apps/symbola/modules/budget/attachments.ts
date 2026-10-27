// BUD-03 — règles pures de l'envoi d'un devis prestataire, testées sans
// base ni stockage : taille maximale et traduction des refus de
// @symbola/files en erreurs du module.
import type { UploadFileResult } from "@symbola/files";

// 20 Mo, valeur proposée par le PRD et acceptée par Julien
// (docs/lots/lot-3-budget.md).
export const QUOTE_MAX_SIZE_BYTES = 20 * 1024 * 1024;

// Durée de validité du lien signé d'ouverture d'un devis.
export const QUOTE_LINK_TTL_SECONDS = 300;

export class QuoteFileTooLargeError extends Error {
  constructor() {
    super("le devis dépasse 20 Mo");
    this.name = "QuoteFileTooLargeError";
  }
}

export class QuoteFileUnsupportedTypeError extends Error {
  constructor() {
    super("format non supporté : PDF ou image uniquement");
    this.name = "QuoteFileUnsupportedTypeError";
  }
}

export class QuoteFileInfectedError extends Error {
  constructor() {
    super("fichier refusé par l'antivirus");
    this.name = "QuoteFileInfectedError";
  }
}

export function quoteUploadError(
  result: Extract<UploadFileResult, { status: "rejected" }>,
): QuoteFileTooLargeError | QuoteFileUnsupportedTypeError | QuoteFileInfectedError {
  switch (result.reason) {
    case "too_large":
      return new QuoteFileTooLargeError();
    case "unsupported_type":
      return new QuoteFileUnsupportedTypeError();
    case "infected":
      return new QuoteFileInfectedError();
  }
}
