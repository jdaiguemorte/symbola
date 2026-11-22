// Lot 43 (FAC-09, FAC-15 ; D1, D7 ; ADR 0089) — règles pures des relances : celle d'une échéance
// impayée (rangs à J+n après l'échéance, une seule fois chacun ; après une panne, seule la plus récente
// manquée part), celle d'un devis avant son expiration (une seule fois, ni signé, ni refusé, ni en
// signature), et la phrase des pénalités de retard. Jours calendaires de Paris, « AAAA-MM-JJ ».
import { addCalendarDays } from "./schedule";

export function dueInvoiceReminder(input: { dueDate: string; offsets: number[]; sentRanks: number[]; today: string }): { rank: number; dueOn: string } | null {
  const sent = new Set(input.sentRanks);
  const lastSent = Math.max(0, ...input.sentRanks);
  let due: { rank: number; dueOn: string } | null = null;
  input.offsets.forEach((offset, index) => {
    const rank = index + 1;
    const dueOn = addCalendarDays(input.dueDate, offset);
    if (rank > lastSent && !sent.has(rank) && dueOn <= input.today) due = { rank, dueOn };
  });
  return due;
}

export function isProposalExpired(validUntil: string | null, today: string): boolean {
  return validUntil !== null && today > validUntil;
}

export function expiryReminderDue(
  input: { status: "draft" | "sent" | "signed" | "declined" | "expired"; validUntil: string | null; remindedAt: Date | null; daysBefore: number; signatureStarted: boolean },
  today: string,
): boolean {
  if (input.status !== "sent" || input.signatureStarted || input.remindedAt || !input.validUntil) return false;
  if (isProposalExpired(input.validUntil, today)) return false;
  return today >= addCalendarDays(input.validUntil, -input.daysBefore);
}

export type PenaltyWords = { noPenalty: string; consumerClause: string; professional: string };

// D7 (AV-7) : professionnel, les pénalités du lot 41 ; particulier ou non-professionnel, seulement si
// l'organisation a renseigné le taux de la clause de son contrat ; sinon, la phrase sans pénalité.
export function penaltySentence(input: { clientKind: "individual" | "professional" | "non_professional"; consumerRateBasisPoints: number | null; locale: "fr" | "en" }, words: PenaltyWords): string {
  if (input.clientKind === "professional") return words.professional;
  if (input.consumerRateBasisPoints === null) return words.noPenalty;
  const rate = new Intl.NumberFormat(input.locale === "en" ? "en-GB" : "fr-FR", { style: "percent", maximumFractionDigits: 2 }).format(input.consumerRateBasisPoints / 10000);
  return words.consumerClause.replace("{taux}", rate);
}

// Lot 53 (HUB-28 ; D5 ; ADR 0095) — rappel au payeur avant l'échéance : à partir de N jours avant (7 au
// départ, automations.json), jusqu'au jour de l'échéance compris ; ni avant, ni après (les relances
// d'impayés du lot 43 prennent le relais). Jamais pour une échéance réglée ou dont le virement est
// déclaré. Retourne le jour où le rappel devait partir, ou null.
export function paymentDueReminderDay(input: { dueDate: string; daysBefore: number; today: string; paid: boolean; declared: boolean }): string | null {
  if (input.paid || input.declared) return null;
  const day = addCalendarDays(input.dueDate, -input.daysBefore);
  return input.today >= day && input.today <= input.dueDate ? day : null;
}
