// Lot 63c (UX-09 ; ADR 0107) — /reglages/<clé> ouvert directement (rechargement, nouvel onglet) : la
// page complète des réglages, qui garde son propre « Retour ». Sur ordinateur, la navigation depuis un
// écran est interceptée par app/@panel et ouvre le panneau.
import { notFound, redirect } from "next/navigation";
import { requirePlanner } from "@/lib/guards";
import { isSettingsPanelKey, SETTINGS_PANELS } from "../panels";

export default async function SettingsPanelRedirect({ params }: { params: Promise<{ key: string }> }) {
  await requirePlanner();
  const { key } = await params;
  if (!isSettingsPanelKey(key)) notFound();
  redirect(SETTINGS_PANELS[key]);
}
