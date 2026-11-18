// Lot 41 (GC-03, D12) — assistant de conformité : avant l'envoi d'un devis, d'un contrat ou d'une
// facture, des points d'attention qui informent et ne bloquent jamais (le blocage reste celui des
// mentions exigées, FAC-07). La liste et ses textes sont des données (compliance-checks.json, FR et
// EN), que l'Admin désactive une à une ; ce fichier ne dit que quand chaque règle s'applique.
// Fonction pure, testée sans base.
import type { ComplianceDocument, ComplianceFinding } from "@symbola/contracts";
import type { ComplianceCheckKey, ComplianceCheckRule } from "@symbola/starter-templates";

// Ce que l'assistant sait de la pièce, lu par le service (aucune donnée personnelle).
export type ComplianceFacts = {
  document: ComplianceDocument;
  professional: boolean;
  orderReference: boolean;
  hasGoods: boolean;
  deliveryAddress: boolean;
  // Particulier, contrat à distance ou hors établissement sans clause de rétractation.
  withdrawalClauseMissing: boolean;
  clausesToDraft: number;
  // Montant au-delà du seuil de signature avancée, signature simple seulement.
  advancedSignatureRecommended: boolean;
  // Acomptes de l'échéancier sans facture, avant la facture de solde.
  depositsNotInvoiced: number;
  // Organisation assujettie dont l'option sur les débits n'est pas renseignée.
  vatOnDebitsUnset: boolean;
  serviceDate: string | null;
  today: string;
};

function inMoreThanAYear(date: string, today: string): boolean {
  const [year, month, day] = today.split("-").map(Number) as [number, number, number];
  const limit = new Date(Date.UTC(year + 1, month - 1, day)).toISOString().slice(0, 10);
  return date > limit;
}

const APPLIES: Record<ComplianceCheckKey, (facts: ComplianceFacts) => boolean> = {
  orderReferenceMissing: (facts) => facts.professional && !facts.orderReference,
  deliveryAddressMissing: (facts) => facts.professional && facts.hasGoods && !facts.deliveryAddress,
  withdrawalClauseMissing: (facts) => facts.withdrawalClauseMissing,
  clauseToDraft: (facts) => facts.clausesToDraft > 0,
  advancedSignatureRecommended: (facts) => facts.advancedSignatureRecommended,
  depositNotInvoiced: (facts) => facts.depositsNotInvoiced > 0,
  vatOnDebitsUnset: (facts) => facts.vatOnDebitsUnset,
  serviceDateMissing: (facts) => facts.serviceDate === null || inMoreThanAYear(facts.serviceDate, facts.today),
};

export function complianceFindings(
  rules: ComplianceCheckRule[],
  disabled: readonly string[],
  facts: ComplianceFacts,
  locale: "fr" | "en",
): ComplianceFinding[] {
  return rules
    .filter((rule) => rule.documents.includes(facts.document) && !disabled.includes(rule.key) && APPLIES[rule.key](facts))
    .map((rule) => ({ key: rule.key, title: rule.title[locale], why: rule.why[locale], target: rule.target }));
}
