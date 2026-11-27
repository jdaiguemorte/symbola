// Lot 70c (EVT-03, CHR-02 ; C-39, M11) — l'onglet « Tâches » de la fiche d'un évènement, qui remplace
// « Rétroplanning ». Les anciennes adresses (`?onglet=retroplanning&tache=<id>`, dans la recherche, les
// notifications et les e-mails déjà partis) mènent au nouvel onglet, avec la même tâche ouverte.

export const TASK_TAB = "taches";
export const LEGACY_TASK_TAB = "retroplanning";

export function legacyTaskTabRedirect(eventId: string, query: Record<string, string | undefined>): string | null {
  if (query.onglet !== LEGACY_TASK_TAB) return null;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, key === "onglet" ? TASK_TAB : value);
  }
  return `/events/${eventId}?${params.toString()}`;
}

// L'adresse d'une tâche d'évènement, ouverte dans son onglet.
export function eventTaskHref(eventId: string, taskId?: string): string {
  return `/events/${eventId}?onglet=${TASK_TAB}${taskId ? `&tache=${taskId}` : ""}`;
}
