// Lot 27b (POR-03, BUD-07) — libellé d'une décision, dans la langue de la
// personne : le contenu figé (poste, dépense) et sa sorte ; partagé par le
// portail, l'aperçu et la fiche de l'événement.
import { formatAmount, type Locale } from "@symbola/i18n";
import type { EventDecision } from "@/modules/events/service";

type Translate = (key: "decisionOptionTitle" | "decisionExpenseTitle" | "decisionProgramTitle", values?: Record<string, string>) => string;

export function decisionLabel(t: Translate, decision: Pick<EventDecision, "snapshot">, locale: Locale): string {
  const { snapshot } = decision;
  if (snapshot.kind === "option") return t("decisionOptionTitle", { slot: snapshot.slotLabel });
  if (snapshot.kind === "expense") {
    return t("decisionExpenseTitle", { label: [snapshot.slotLabel, snapshot.vendorName, snapshot.label].filter((part, index, all) => part && all.indexOf(part) === index).join(" — "), amount: formatAmount(snapshot.amountCents, locale) });
  }
  return t("decisionProgramTitle");
}

// Nom de l'option choisie, pris dans le contenu figé.
export function choiceName(decision: Pick<EventDecision, "snapshot" | "choiceId">): string | null {
  return decision.snapshot.kind === "option" ? (decision.snapshot.options.find((option) => option.candidateId === decision.choiceId)?.vendorName ?? null) : null;
}
