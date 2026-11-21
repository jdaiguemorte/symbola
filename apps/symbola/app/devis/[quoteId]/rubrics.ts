// Lot 62d (UX-12, UX-13) — le devis en rubriques : la liste des rubriques et leur adresse
// (`?rubrique=`), la rubrique d'une ancre d'avant le lot (« Aujourd'hui », radar, vérifications), ce
// qui reste à facturer, et la prochaine action du devis selon son statut (le seul bouton principal de
// l'écran). Fonctions pures : aucune règle de calcul, de signature ou de facturation ne change ici.
import type { InvoiceView, QuoteDetail, ScheduleItemView } from "@/modules/quotes/service";

export const RUBRICS = ["lignes", "proposition", "paiement", "acheteur", "honoraires", "contrat", "factures"] as const;
export type Rubric = (typeof RUBRICS)[number];

// Les factures n'ont leur rubrique qu'une fois le devis signé, ou dès qu'une pièce existe.
export function availableRubrics(input: { status: QuoteDetail["status"]; invoiceCount: number; receiptCount: number }): Rubric[] {
  const invoices = input.status === "signed" || input.invoiceCount > 0 || input.receiptCount > 0;
  return RUBRICS.filter((rubric) => rubric !== "factures" || invoices);
}

// Une rubrique inconnue, ou absente pour ce devis, ramène aux lignes.
export function parseRubric(value: string | string[] | undefined, available: readonly Rubric[]): Rubric {
  const asked = Array.isArray(value) ? value[0] : value;
  return available.find((rubric) => rubric === asked) ?? "lignes";
}

export function rubricHref(quoteId: string, rubric: Rubric, anchor?: string): string {
  return `/devis/${quoteId}${rubric === "lignes" ? "" : `?rubrique=${rubric}`}${anchor ? `#${anchor}` : ""}`;
}

// Ancres des sections du devis, du temps où tout tenait sur une page : elles restent des adresses
// valables (liens d'« Aujourd'hui », du radar, des vérifications avant envoi).
const ANCHOR_RUBRICS: Record<string, Rubric> = {
  proposition: "proposition",
  "acompte-arrhes": "paiement",
  echeancier: "paiement",
  reglement: "paiement",
  acheteur: "acheteur",
  argent: "honoraires",
  contrat: "contrat",
  signature: "contrat",
  factures: "factures",
};

// « #reglement-<échéance> » appartient à « reglement ».
export function rubricOfAnchor(hash: string): Rubric | null {
  const anchor = hash.replace(/^#/, "");
  if (anchor === "") return null;
  const known = Object.keys(ANCHOR_RUBRICS).find((key) => anchor === key || anchor.startsWith(`${key}-`));
  return known ? ANCHOR_RUBRICS[known]! : null;
}

// Adresse d'une ancre du devis depuis n'importe quelle rubrique (« #acheteur » → sa rubrique).
export function anchorHref(target: string): string {
  const rubric = rubricOfAnchor(target);
  return rubric === null ? target : `?rubrique=${rubric}${target}`;
}

export type InvoicePlan = {
  earnest: boolean;
  balanceIssued: boolean;
  // Échéances dont la facture d'acompte reste à émettre (aucune pour des arrhes, ou après le solde).
  pendingItems: ScheduleItemView[];
};

// DEV-04 — ce qui reste à facturer : une facture entièrement annulée par avoir ne compte plus.
export function invoicePlan(quote: Pick<QuoteDetail, "current">, invoices: Pick<InvoiceView, "kind" | "scheduleItemId" | "amountCents" | "creditedCents">[]): InvoicePlan {
  const active = invoices.filter((invoice) => invoice.amountCents - invoice.creditedCents > 0);
  const balanceIssued = active.some((invoice) => invoice.kind === "balance");
  const invoicedItems = new Set(active.flatMap((invoice) => (invoice.scheduleItemId ? [invoice.scheduleItemId] : [])));
  const earnest = quote.current.advanceKind === "earnest";
  const pendingItems = balanceIssued || earnest ? [] : quote.current.schedule.items.filter((item) => !invoicedItems.has(item.id));
  return { earnest, balanceIssued, pendingItems };
}

export type NextAction =
  | { kind: "send" }
  | { kind: "revise"; reason: "regime" | "declined" }
  | { kind: "sign" }
  // La prochaine pièce à émettre : la facture d'acompte d'une échéance, sinon celle du solde.
  | { kind: "invoice"; scheduleItemId: string | null };

// La prochaine action du devis, ou aucune quand la suite ne dépend pas de la planner (signature en
// attente du client, tout facturé).
export function nextAction(input: {
  quote: Pick<QuoteDetail, "status" | "current" | "regimeChangedSinceSent" | "signature">;
  plan: InvoicePlan;
  signatureAvailable: boolean;
}): NextAction | null {
  const { quote, plan } = input;
  if (quote.current.sentAt === null) return { kind: "send" };
  if (quote.regimeChangedSinceSent) return { kind: "revise", reason: "regime" };
  if (quote.status === "declined") return { kind: "revise", reason: "declined" };
  if (quote.status === "sent") return quote.signature === null && input.signatureAvailable ? { kind: "sign" } : null;
  if (quote.status === "signed") {
    const [first] = plan.pendingItems;
    if (first) return { kind: "invoice", scheduleItemId: first.id };
    return plan.balanceIssued ? null : { kind: "invoice", scheduleItemId: null };
  }
  return null;
}
