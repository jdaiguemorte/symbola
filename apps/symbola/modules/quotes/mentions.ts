// Lot 31a (FAC-07, JUR-01, JUR-09 ; décision D4) — contrôle des mentions requises avant
// l'envoi d'un devis et l'émission d'une facture ou d'un avoir. La liste (des données, jamais
// le code) dit quoi exiger selon le document, le régime de TVA, le type de client et la forme
// juridique ; le refus nomme chaque champ manquant. Fonction pure.
import type { MissingMention } from "@symbola/contracts";
import type { MentionDocument, RequiredMentionRule } from "@symbola/starter-templates";

export type MentionValues = {
  organizationName: string | null;
  address: string | null;
  siren: string | null;
  siret: string | null;
  registration: string | null;
  shareCapitalCents: number | null;
  vatNumber: string | null;
  insurer: string | null;
  insurancePolicy: string | null;
  mediatorName: string | null;
  mediatorUrl: string | null;
  generalTerms: string | null;
  paymentTerms: string | null;
};

export type MentionContext = {
  document: MentionDocument;
  vatRegime: "franchise" | "assujetti" | null;
  clientKind: "individual" | "professional";
  legalForm: string | null;
  values: MentionValues;
};

const filled = (value: string | null | undefined) => typeof value === "string" && value.trim() !== "";

function present(field: RequiredMentionRule["field"], values: MentionValues): boolean {
  switch (field) {
    case "organizationName":
      return filled(values.organizationName);
    case "address":
      return filled(values.address);
    // SIREN, ou SIRET qui le contient.
    case "siren":
      return filled(values.siren) || filled(values.siret);
    case "registration":
      return filled(values.registration);
    case "shareCapital":
      return values.shareCapitalCents !== null;
    case "vatNumber":
      return filled(values.vatNumber);
    case "insurance":
      return filled(values.insurer) && filled(values.insurancePolicy);
    case "mediator":
      return filled(values.mediatorName) && filled(values.mediatorUrl);
    case "generalTerms":
      return filled(values.generalTerms);
    case "paymentTerms":
      return filled(values.paymentTerms);
  }
}

function applies(rule: RequiredMentionRule, context: MentionContext): boolean {
  if (!rule.documents.includes(context.document)) return false;
  if (rule.vatRegimes && (context.vatRegime === null || !rule.vatRegimes.includes(context.vatRegime))) return false;
  if (rule.clientKinds && !rule.clientKinds.includes(context.clientKind)) return false;
  if (rule.legalForms && (context.legalForm === null || !(rule.legalForms as string[]).includes(context.legalForm))) return false;
  return true;
}

// Les mentions requises absentes, dans l'ordre de la liste, sans doublon.
export function missingMentions(rules: RequiredMentionRule[], context: MentionContext): MissingMention[] {
  const missing: MissingMention[] = [];
  for (const rule of rules) {
    if (applies(rule, context) && !present(rule.field, context.values) && !missing.includes(rule.field)) missing.push(rule.field);
  }
  return missing;
}
