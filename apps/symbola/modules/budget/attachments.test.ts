import { describe, expect, it } from "vitest";
import {
  QUOTE_MAX_SIZE_BYTES,
  QuoteFileInfectedError,
  QuoteFileTooLargeError,
  QuoteFileUnsupportedTypeError,
  quoteUploadError,
} from "./attachments";

describe("BUD-03 — Refus d'un devis prestataire", () => {
  it("limite un devis à 20 Mo", () => {
    expect(QUOTE_MAX_SIZE_BYTES).toBe(20 * 1024 * 1024);
  });

  it("traduit chaque refus de l'envoi en erreur claire, y compris un fichier infecté", () => {
    expect(quoteUploadError({ status: "rejected", reason: "too_large" })).toBeInstanceOf(QuoteFileTooLargeError);
    expect(quoteUploadError({ status: "rejected", reason: "unsupported_type" })).toBeInstanceOf(
      QuoteFileUnsupportedTypeError,
    );
    expect(
      quoteUploadError({ status: "rejected", reason: "infected", signature: "Eicar-Signature" }),
    ).toBeInstanceOf(QuoteFileInfectedError);
  });
});
