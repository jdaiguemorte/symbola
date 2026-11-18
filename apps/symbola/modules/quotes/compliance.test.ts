// Lot 41 (GC-03, D12) — chaque règle du jeu de départ s'affiche dans son cas et pas en dehors ;
// aucune ne bloque ; la mention « ne remplace pas un conseil » ; une règle désactivée ne s'affiche plus.
import { describe, expect, it } from "vitest";
import { COMPLIANCE_CHECK_KEYS, starterComplianceChecks } from "@symbola/starter-templates";
import { complianceFindings, type ComplianceFacts } from "./compliance";

const { checks, disclaimer } = starterComplianceChecks();

// Une pièce sans aucun point d'attention.
const clean: ComplianceFacts = {
  document: "quote",
  professional: false,
  orderReference: false,
  hasGoods: false,
  deliveryAddress: false,
  withdrawalClauseMissing: false,
  clausesToDraft: 0,
  advancedSignatureRecommended: false,
  depositsNotInvoiced: 0,
  vatOnDebitsUnset: false,
  serviceDate: "2027-09-18",
  today: "2027-04-10",
};

const keys = (facts: Partial<ComplianceFacts>, disabled: string[] = []) => complianceFindings(checks, disabled, { ...clean, ...facts }, "fr").map((finding) => finding.key);

describe("GC-03 — Assistant de conformité", () => {
  it("le jeu de départ couvre les huit vérifications, chacune avec son constat, sa raison et sa cible, en français et en anglais", () => {
    expect(checks.map((check) => check.key)).toEqual([...COMPLIANCE_CHECK_KEYS]);
    for (const check of checks) {
      expect(check.title.fr && check.title.en && check.why.fr && check.why.en && check.target).toBeTruthy();
    }
  });

  it("une pièce sans point d'attention n'affiche rien", () => {
    for (const document of ["quote", "contract", "invoice"] as const) expect(keys({ document })).toEqual([]);
  });

  it("client professionnel sans bon de commande : devis et facture, jamais pour un particulier ni sur un contrat", () => {
    expect(keys({ professional: true })).toEqual(["orderReferenceMissing"]);
    expect(keys({ professional: true, document: "invoice" })).toEqual(["orderReferenceMissing"]);
    expect(keys({ professional: true, document: "contract" })).toEqual([]);
    expect(keys({ professional: true, orderReference: true })).toEqual([]);
  });

  it("des biens livrés à un professionnel sans adresse de livraison ; rien pour des services ou avec l'adresse", () => {
    expect(keys({ professional: true, orderReference: true, hasGoods: true })).toEqual(["deliveryAddressMissing"]);
    expect(keys({ professional: true, orderReference: true, hasGoods: true, deliveryAddress: true })).toEqual([]);
    expect(keys({ professional: false, hasGoods: true })).toEqual([]);
  });

  it("contrat à distance ou hors établissement sans clause de rétractation : devis et contrat", () => {
    expect(keys({ withdrawalClauseMissing: true })).toEqual(["withdrawalClauseMissing"]);
    expect(keys({ withdrawalClauseMissing: true, document: "contract" })).toEqual(["withdrawalClauseMissing"]);
    expect(keys({ withdrawalClauseMissing: true, document: "invoice" })).toEqual([]);
  });

  it("clause « à rédiger » et signature simple au-delà du seuil : sur le contrat seulement", () => {
    expect(keys({ clausesToDraft: 2, document: "contract" })).toEqual(["clauseToDraft"]);
    expect(keys({ clausesToDraft: 2 })).toEqual([]);
    expect(keys({ advancedSignatureRecommended: true, document: "contract" })).toEqual(["advancedSignatureRecommended"]);
    expect(keys({ advancedSignatureRecommended: true, document: "invoice" })).toEqual([]);
  });

  it("facture de solde alors qu'un acompte n'est pas facturé : sur la facture seulement", () => {
    expect(keys({ depositsNotInvoiced: 1, document: "invoice" })).toEqual(["depositNotInvoiced"]);
    expect(keys({ depositsNotInvoiced: 1 })).toEqual([]);
  });

  it("option sur les débits non renseignée (assujetti) : devis et facture", () => {
    expect(keys({ vatOnDebitsUnset: true })).toEqual(["vatOnDebitsUnset"]);
    expect(keys({ vatOnDebitsUnset: true, document: "invoice" })).toEqual(["vatOnDebitsUnset"]);
  });

  it("date de la prestation absente, ou à plus d'un an : la veille du terme non, le lendemain oui", () => {
    expect(keys({ serviceDate: null })).toEqual(["serviceDateMissing"]);
    expect(keys({ serviceDate: "2028-04-10" })).toEqual([]);
    expect(keys({ serviceDate: "2028-04-11" })).toEqual(["serviceDateMissing"]);
    expect(keys({ serviceDate: null, document: "contract" })).toEqual([]);
  });

  it("une règle désactivée par l'Admin ne s'affiche plus ; les autres restent", () => {
    expect(keys({ professional: true, vatOnDebitsUnset: true }, ["orderReferenceMissing"])).toEqual(["vatOnDebitsUnset"]);
  });

  it("chaque point dit le constat, pourquoi il compte et où agir ; la mention « ne remplace pas un conseil » est en données", () => {
    const [finding] = complianceFindings(checks, [], { ...clean, professional: true }, "en");
    expect(finding).toEqual({ key: "orderReferenceMissing", title: "Business client without a purchase order number", why: expect.stringContaining("purchase order"), target: "#acheteur" });
    expect(disclaimer.fr).toBe("Ces vérifications vous aident ; elles ne remplacent pas le conseil d'un professionnel du droit ou de la comptabilité.");
    expect(disclaimer.en).toContain("do not replace");
  });
});
