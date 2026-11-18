// Lot 43 (GC-01, JUR-07, FAC-08 ; ADR 0087, ADR 0089) — règle pure de l'écran « Régler l'acompte » :
// ce qu'il montre selon le canal de conclusion du contrat (règles du lot 31b, inchangées) et l'état de
// l'échéance. Hors établissement, aucun paiement ne peut être demandé pendant les jours fixés par
// contract-rules.json (sept) : ni RIB ni déclaration avant ; le RIB arrive par e-mail ce jour-là.
import { addCalendarDays } from "./schedule";

export type SettlementChannel = "on_premises" | "distance" | "off_premises";

export type SettlementFacts = {
  // Jour (Paris) où le dernier signataire a signé ; null tant que tous n'ont pas signé.
  completedOn: string | null;
  // Canal du contrat signé avec le devis (null : devis signé sans contrat).
  channel: SettlementChannel | null;
  withdrawalApplies: boolean;
  // Jours sans paiement après la signature (régime du contrat), sinon null.
  noPaymentDays: number | null;
  declared: boolean;
  paid: boolean;
};

export type SettlementState =
  | { kind: "awaiting_signatures" }
  | { kind: "not_before"; date: string }
  | { kind: "open"; notice: "distance" | "off_premises" | null }
  | { kind: "declared" }
  | { kind: "paid" };

// Premier jour où un paiement peut être demandé ; null : dès la signature.
export function paymentOpensOn(facts: Pick<SettlementFacts, "completedOn" | "noPaymentDays">): string | null {
  if (!facts.completedOn || facts.noPaymentDays === null) return null;
  return addCalendarDays(facts.completedOn, facts.noPaymentDays);
}

export function settlementState(facts: SettlementFacts, today: string): SettlementState {
  if (facts.paid) return { kind: "paid" };
  if (facts.declared) return { kind: "declared" };
  if (!facts.completedOn) return { kind: "awaiting_signatures" };
  const opensOn = paymentOpensOn(facts);
  if (opensOn && today < opensOn) return { kind: "not_before", date: opensOn };
  if (facts.withdrawalApplies && facts.channel === "distance") return { kind: "open", notice: "distance" };
  if (facts.withdrawalApplies && facts.channel === "off_premises") return { kind: "open", notice: "off_premises" };
  return { kind: "open", notice: null };
}
