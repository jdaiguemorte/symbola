// Lot 27a (POR-02, décisions D2 et D3) — règles pures de l'accueil du portail :
// compte à rebours, avancement, « vos trois prochaines actions ». Elles
// réunissent ce que les modules renvoient (tâches, devis à signer, échéances) ;
// aucune lecture en base ici.
import type { EventTask } from "@/modules/events/service";
import type { LinkVendorPayment } from "@/modules/budget/service";
import type { ClientQuoteToSign } from "@/modules/quotes/service";

const DAY_MS = 24 * 60 * 60 * 1000;

export type Countdown = { kind: "unset" } | { kind: "past" } | { kind: "today" } | { kind: "tomorrow" } | { kind: "days"; days: number };

// Jours du calendrier de Paris jusqu'à l'événement (« today » est déjà la date de Paris).
export function countdown(eventDate: string | null, today: string): Countdown {
  if (!eventDate) return { kind: "unset" };
  const days = Math.round((Date.parse(`${eventDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (days < 0) return { kind: "past" };
  if (days === 0) return { kind: "today" };
  if (days === 1) return { kind: "tomorrow" };
  return { kind: "days", days };
}

// D3 : tâches faites sur tout le rétroplanning, sans leur détail.
export function progress(tasks: Pick<EventTask, "done">[]): { done: number; total: number } {
  return { done: tasks.filter((task) => task.done).length, total: tasks.length };
}

export type NextAction =
  | { kind: "task"; id: string; label: string; dueDate: string; overdue: boolean }
  | { kind: "quote"; id: string; number: string; version: number }
  | { kind: "payment"; id: string; slotLabel: string; vendorName: string | null; label: string; amountCents: number; dueDate: string; overdue: boolean };

const KIND_ORDER: Record<NextAction["kind"], number> = { task: 0, payment: 1, quote: 2 };

// D2 : ce que la personne peut faire, selon ses rubriques (null = rubrique
// fermée) : ses tâches non faites, les devis qu'elle doit signer, les
// échéances de ses catégories à régler. Les retards d'abord, puis par date ;
// un devis à signer compte pour aujourd'hui.
export function nextActions(
  input: {
    tasks: Pick<EventTask, "id" | "label" | "dueDate" | "done" | "responsible">[] | null;
    quotes: Pick<ClientQuoteToSign, "quoteId" | "number" | "version" | "status" | "ownStatus" | "ownSigningUrl">[];
    payments: Pick<LinkVendorPayment, "id" | "slotLabel" | "vendorName" | "label" | "amountCents" | "dueOn" | "status">[] | null;
    today: string;
  },
  limit = 3,
): NextAction[] {
  const { today } = input;
  const actions: NextAction[] = [
    ...(input.tasks ?? [])
      .filter((task) => task.responsible === "clients" && !task.done)
      .map((task): NextAction => ({ kind: "task", id: task.id, label: task.label, dueDate: task.dueDate, overdue: task.dueDate < today })),
    ...input.quotes
      .filter((quote) => quote.status === "pending" && quote.ownStatus === "pending" && quote.ownSigningUrl !== null)
      .map((quote): NextAction => ({ kind: "quote", id: quote.quoteId, number: quote.number, version: quote.version })),
    ...(input.payments ?? [])
      .filter((payment) => payment.status === "due" || payment.status === "overdue")
      .map(
        (payment): NextAction => ({
          kind: "payment",
          id: payment.id,
          slotLabel: payment.slotLabel,
          vendorName: payment.vendorName,
          label: payment.label,
          amountCents: payment.amountCents,
          dueDate: payment.dueOn,
          overdue: payment.dueOn < today,
        }),
      ),
  ];
  const dateOf = (action: NextAction) => (action.kind === "quote" ? today : action.dueDate);
  return actions
    .sort((a, b) => {
      const lateA = dateOf(a) < today ? 0 : 1;
      const lateB = dateOf(b) < today ? 0 : 1;
      return lateA - lateB || dateOf(a).localeCompare(dateOf(b)) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    })
    .slice(0, limit);
}
