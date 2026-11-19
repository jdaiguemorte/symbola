// Lot 16 (ADR 0045) : vocabulaire du type de l'événement affiché.
// Lot 52 (EVT-06, SEC-13 ; D2) : un évènement hors de vue d'une Planner (réglage de visibilité coupé,
// hors de son équipe) répond comme un évènement inexistant, pour chacun de ses écrans.
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { EventVocabulary } from "@/app/event-vocabulary";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { canSeeEvent } from "@/lib/event-visibility";

export default async function EventPageLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "authenticated" && auth.user.organizationId && auth.user.role === "member") {
    const { id } = await params;
    if (!(await canSeeEvent({ user: { id: auth.user.id, role: auth.user.role, organizationId: auth.user.organizationId } }, id))) notFound();
  }
  return <EventVocabulary>{children}</EventVocabulary>;
}
