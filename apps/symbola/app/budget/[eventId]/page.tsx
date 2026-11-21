// Lot 63c (BUD-01, BUD-03, BUD-04 ; #40, maquette M9) — une seule vue du budget : /budget/<id> mène à
// l'onglet « Budget et prestataires » de la fiche, qui contrôle lui-même la session, l'organisation et
// les modules. Le détail (simulation, HT, exports, payeurs) est sous /budget/<id>/detail.
import { notFound, redirect } from "next/navigation";
import { requirePlanner } from "@/lib/guards";
import { isValidId } from "../module-access";

export default async function EventBudgetPage({ params }: { params: Promise<{ eventId: string }> }) {
  await requirePlanner();
  const { eventId } = await params;
  if (!isValidId(eventId)) notFound();
  redirect(`/events/${eventId}?onglet=budget`);
}
