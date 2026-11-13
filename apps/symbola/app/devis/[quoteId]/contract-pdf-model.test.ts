// Lot 31b (FAC-04, DOC-03, JUR-07 ; D9, D11, partie N) — contenu du PDF du contrat et du dossier
// de preuve, sans rendu : articles numérotés, régime de conclusion, version et revue du modèle,
// zone de signature, et faits du dossier repris tels quels.
import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import { contractPdfLabels, evidencePdfLabels, type Translate } from "../document-labels";
import type { ContractView } from "@/modules/quotes/service";
import { buildContractPdfModel, buildEvidencePdfModel } from "./contract-pdf-model";

const t = createTranslator({ locale: "fr", messages: frMessages, namespace: "Contracts" }) as unknown as Translate;
const tDocuments = createTranslator({ locale: "fr", messages: frMessages, namespace: "Documents" }) as unknown as Translate;

const contract: ContractView = {
  id: "c1",
  quoteId: "q1",
  quoteVersion: 1,
  version: 2,
  templateId: "t1",
  templateVersion: 4,
  templateReviewedOn: "2027-01-15",
  title: "Contrat de prestation de services",
  clauses: [
    { title: "Parties", body: "Entre l'atelier et Léa Martin et Maxime Durand.", role: null },
    { title: "Droit de rétractation", body: "Quatorze jours (texte du conseil).", role: "withdrawal_period" },
  ],
  conclusionChannel: "distance",
  clientCategory: "individual",
  smallBusinessConfirmed: false,
  regime: { withdrawalApplies: true, orderRequired: true, noPaymentDays: null, requiredRoles: [] },
  signatureLevel: "simple",
  recommendedSignatureLevel: "simple",
  generatedAt: "2027-03-01T09:00:00.000Z",
  outdated: false,
  signature: null,
  acts: [],
  hasEvidence: false,
};

const seller = { organizationName: "Atelier Lumière", address: "1 rue des Lilas, 69001 Lyon", siren: "123456789", logoKey: null };

describe("FAC-04 / DOC-03 — PDF du contrat (lot 31b, D9, D11)", () => {
  it("articles numérotés, régime de conclusion, version et date de revue du modèle", () => {
    const model = buildContractPdfModel({ quoteNumber: "D-2027-0001", contract, seller, logo: null, labels: contractPdfLabels(t, tDocuments), locale: "fr", withdrawalDays: 14, watermark: null, defaultColor: "#3d5a80" });
    expect(model.kind).toBe("Contrat");
    expect(model.subtitle).toBe("Contrat V2 · devis D-2027-0001 V1");
    expect(model.articles.map((article) => article.heading)).toEqual(["Article 1 — Parties", "Article 2 — Droit de rétractation"]);
    expect(model.regime.lines).toEqual(["Conclu à distance", "Client consommateur", "Droit de rétractation : 14 jours, dans les conditions du contrat"]);
    expect(model.template).toBe("Modèle version 4, dernière revue juridique le 15 janvier 2027");
    expect(model.signature).toBeNull();
  });

  it("hors établissement, sans revue datée ; la zone de signature dit si le devis est signé avec le contrat", () => {
    const outside = { ...contract, conclusionChannel: "off_premises" as const, templateReviewedOn: null, regime: { ...contract.regime, orderRequired: false, noPaymentDays: 7 } };
    const slots = [{ role: "Signataire 1", tag: "{{SIGNATURE, r1}}" }];
    const withQuote = buildContractPdfModel({ quoteNumber: "D-2027-0001", contract: outside, seller, logo: null, labels: contractPdfLabels(t, tDocuments), locale: "fr", withdrawalDays: 14, watermark: null, defaultColor: "#3d5a80", signatureSlots: slots, withQuote: true });
    expect(withQuote.regime.lines.at(-1)).toBe("Aucun paiement avant 7 jours après la signature");
    expect(withQuote.template).toBe("Modèle version 4, sans revue juridique datée");
    expect(withQuote.signature).toEqual({ title: "Bon pour accord du devis et du contrat", slots });
    const alone = buildContractPdfModel({ quoteNumber: "D-2027-0001", contract: outside, seller, logo: null, labels: contractPdfLabels(t, tDocuments), locale: "fr", withdrawalDays: 14, watermark: null, defaultColor: "#3d5a80", signatureSlots: slots });
    expect(alone.signature?.title).toBe("Bon pour accord du contrat");
  });
});

describe("JUR-07 — Dossier de preuve lisible (lot 31b, réponses 1 et 5 de l'avocat)", () => {
  it("reprend les faits scellés et leurs empreintes, sans rien y ajouter", () => {
    const model = buildEvidencePdfModel(
      {
        version: 1,
        writtenAt: "2027-03-02T10:00:00.000Z",
        quote: { number: "D-2027-0001", version: 1 },
        contract: { id: "c1", version: 2, title: "Contrat de prestation de services", templateVersion: 4, templateReviewedOn: null, generatedAt: "2027-03-01T09:00:00.000Z", conclusionChannel: "distance", clientCategory: "individual", smallBusinessConfirmed: false, withdrawalApplies: true, signatureLevel: "simple" },
        request: { kind: "quote_contract", provider: "documenso", externalId: "42", createdAt: "2027-03-01T10:00:00.000Z", completedAt: "2027-03-02T09:00:00.000Z" },
        signers: [{ id: "s1", name: "Léa Martin", email: "lea@example.test", status: "signed", signedAt: "2027-03-02T09:00:00.000Z" }],
        acts: [{ signerId: "s1", signerName: "Léa Martin", kind: "order", actedAt: "2027-03-01T11:00:00.000Z", presentedText: "Je commande avec obligation de paiement" }],
        documents: { signedDocumentSha256: "a".repeat(64), auditCertificateSha256: "b".repeat(64) },
        sha256: "c".repeat(64),
      },
      evidencePdfLabels(t),
      "fr",
    );
    expect(model.title).toBe("Dossier de preuve");
    expect(model.sections.map((section) => section.title)).toEqual(["Contrat", "Signature", "Signataires", "Actes des signataires sur leur portail", "Empreintes SHA-256"]);
    expect(model.sections[0]!.lines).toContain("Canal de conclusion : Conclu à distance");
    expect(model.sections[3]!.lines[0]).toMatch(/^Léa Martin : Commande avec obligation de paiement, le /);
    expect(model.sections[3]!.lines[1]).toBe("Texte présenté : Je commande avec obligation de paiement");
    expect(model.sections[4]!.lines).toContain(`Ce dossier (JSON) : ${"c".repeat(64)}`);
  });
});
