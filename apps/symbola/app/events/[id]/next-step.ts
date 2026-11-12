// Lot 13 (L13-EVT-19) — bandeau « Prochaine étape » de la fiche événement :
// l'action logique suivante selon l'état de l'événement, une seule à la fois.
import type { EventStatus } from "@/modules/events/service";

export type NextStep = "send_quote" | "apply_retroplanning" | "prepare_program" | "invite_clients";

export type NextStepInput = {
  status: EventStatus;
  isDemo: boolean;
  quotesAvailable: boolean;
  hasSentOrSignedQuote: boolean;
  taskCount: number;
  templateCount: number;
  eventDate: string | null;
  programItemCount: number;
  clientLinkCount: number;
  today: string;
};

// Le programme se prépare dans les 3 mois qui précèdent l'événement.
function withinThreeMonths(eventDate: string, today: string): boolean {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCMonth(limit.getUTCMonth() + 3);
  return eventDate >= today && eventDate <= limit.toISOString().slice(0, 10);
}

export function nextStep(input: NextStepInput): NextStep | null {
  if (input.isDemo) return null;
  if (input.status === "prospect") return input.quotesAvailable && !input.hasSentOrSignedQuote ? "send_quote" : null;
  if (input.status !== "confirmed") return null;
  if (input.taskCount === 0 && input.templateCount > 0) return "apply_retroplanning";
  if (input.programItemCount === 0 && input.eventDate && withinThreeMonths(input.eventDate, input.today)) return "prepare_program";
  if (input.clientLinkCount === 0) return "invite_clients";
  return null;
}
