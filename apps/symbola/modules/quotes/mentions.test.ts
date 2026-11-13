// Lot 31a (FAC-07, JUR-01, JUR-09 ; décision D4) — mentions requises par cas : franchise ou
// assujetti, particulier ou entreprise, société ou entreprise individuelle.
import { describe, expect, it } from "vitest";
import { starterRequiredMentions } from "@symbola/starter-templates";
import { missingMentions, type MentionValues } from "./mentions";

const complete: MentionValues = {
  organizationName: "Atelier Camille R.",
  address: "12 rue des Tilleuls, 24200 Sarlat",
  siren: "123456789",
  siret: null,
  registration: "RCS Bergerac 123 456 789",
  shareCapitalCents: 100000,
  vatNumber: "FR12123456789",
  insurer: "Assurances du Périgord",
  insurancePolicy: "RCP-2027-001",
  mediatorName: "Médiateur de la consommation",
  mediatorUrl: "https://mediateur.example",
  generalTerms: "Conditions générales de vente…",
  paymentTerms: "À réception de la facture.",
  professionalPaymentTerms: "Par virement à l'échéance.",
  latePenaltyRate: "ecb_plus_10",
};
const rules = starterRequiredMentions();
const context = (document: "quote" | "deposit_invoice" | "balance_invoice" | "credit_note", values: Partial<MentionValues>, extra: { vatRegime?: "franchise" | "assujetti"; clientKind?: "individual" | "professional" | "non_professional"; legalForm?: string | null } = {}) => ({
  document,
  vatRegime: extra.vatRegime ?? "franchise",
  clientKind: extra.clientKind ?? "individual",
  legalForm: extra.legalForm === undefined ? "auto_entrepreneur" : extra.legalForm,
  values: { ...complete, ...values },
});

describe("FAC-07 — L'émission est refusée si une mention requise manque ; le message nomme le champ (lot 31a)", () => {
  it("tout est rempli : rien ne manque, pour chaque document", () => {
    for (const document of ["quote", "deposit_invoice", "balance_invoice", "credit_note"] as const) {
      expect(missingMentions(rules, context(document, {}, { vatRegime: "assujetti", legalForm: "sas" }))).toEqual([]);
    }
  });

  it("devis à un particulier : assurance, médiateur et conditions générales, nommés", () => {
    expect(missingMentions(rules, context("quote", { insurancePolicy: null, mediatorUrl: " ", generalTerms: null }))).toEqual(["insurance", "mediator", "generalTerms"]);
  });

  it("le médiateur et les conditions générales ne sont pas demandés pour une entreprise cliente", () => {
    expect(missingMentions(rules, context("quote", { mediatorName: null, generalTerms: null }, { clientKind: "professional" }))).toEqual([]);
  });

  it("numéro de TVA : seulement en assujetti ; capital et RCS : seulement pour une société", () => {
    expect(missingMentions(rules, context("deposit_invoice", { vatNumber: null, registration: null, shareCapitalCents: null }))).toEqual([]);
    expect(missingMentions(rules, context("deposit_invoice", { vatNumber: null }, { vatRegime: "assujetti" }))).toEqual(["vatNumber"]);
    expect(missingMentions(rules, context("balance_invoice", { registration: null, shareCapitalCents: null }, { legalForm: "sarl" }))).toEqual(["registration", "shareCapital"]);
  });

  it("le SIRET suffit à la place du SIREN ; les conditions de paiement sont exigées sur les factures, pas sur l'avoir", () => {
    expect(missingMentions(rules, context("quote", { siren: null, siret: "12345678900012" }))).toEqual([]);
    expect(missingMentions(rules, context("balance_invoice", { paymentTerms: null }))).toEqual(["paymentTerms"]);
    expect(missingMentions(rules, context("credit_note", { paymentTerms: null, insurer: null }))).toEqual([]);
  });

  it("une liste de l'Admin remplace celle de départ", () => {
    expect(missingMentions([{ field: "insurance", documents: ["credit_note"] }], context("credit_note", { insurer: null }))).toEqual(["insurance"]);
  });
});

describe("FAC-07 / JUR-01 — Conditions de paiement selon le client (lot 31c, expert-comptable, D18)", () => {
  it("devis, facture d'acompte et de solde d'un professionnel : texte professionnel et taux des pénalités, chacun nommé", () => {
    for (const document of ["quote", "deposit_invoice", "balance_invoice"] as const) {
      expect(missingMentions(rules, context(document, { professionalPaymentTerms: null, latePenaltyRate: null }, { clientKind: "professional" }))).toEqual(["professionalPaymentTerms", "latePenaltyRate"]);
    }
    // Le texte des particuliers ne lui est pas demandé.
    expect(missingMentions(rules, context("balance_invoice", { paymentTerms: null }, { clientKind: "professional" }))).toEqual([]);
  });

  it("particulier et non-professionnel : leur texte sur les factures ; ni texte professionnel ni taux", () => {
    for (const clientKind of ["individual", "non_professional"] as const) {
      expect(missingMentions(rules, context("deposit_invoice", { paymentTerms: null, professionalPaymentTerms: null, latePenaltyRate: null }, { clientKind }))).toEqual(["paymentTerms"]);
      expect(missingMentions(rules, context("quote", { professionalPaymentTerms: null, latePenaltyRate: null }, { clientKind }))).toEqual([]);
    }
  });
});
