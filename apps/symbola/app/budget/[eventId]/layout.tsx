// Lot 16 (ADR 0045) : vocabulaire du type de l'événement affiché.
import type { ReactNode } from "react";
import { EventVocabulary } from "@/app/event-vocabulary";

export default function EventPageLayout({ children }: { children: ReactNode }) {
  return <EventVocabulary>{children}</EventVocabulary>;
}
