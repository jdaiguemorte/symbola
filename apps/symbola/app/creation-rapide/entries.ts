// Lot 70e (HUB-07, HUB-06, ARC-06 ; M7, A12) — les entrées de « + Créer », dans l'ordre de la journée :
// l'évènement, ses tâches, le carnet de prestataires, les contacts, puis le devis et la dépense d'un
// mariage. Une entrée dont le module n'est pas souscrit n'apparaît pas. Règles pures, sans base.
export type QuickModules = { events: boolean; quotes: boolean; budget: boolean; vendors: boolean };

export type QuickEntryKey = "event" | "task" | "vendor" | "contact" | "quote" | "expense";

export type QuickEntry = {
  key: QuickEntryKey;
  // « link » : mène à l'écran de création ; « dialog » : fenêtre courte sans quitter l'écran.
  action: "link" | "dialog";
  href?: string;
  // Dit le mariage de l'écran en cours (« Tâche pour Léa & Maxime »).
  contextual: boolean;
};

export function quickCreateEntries(modules: QuickModules): QuickEntry[] {
  return [
    ...(modules.events ? [{ key: "event", action: "link", href: "/events/new", contextual: false } as const, { key: "task", action: "dialog", contextual: true } as const] : []),
    ...(modules.vendors ? [{ key: "vendor", action: "link", href: "/prestataires/nouveau", contextual: false } as const] : []),
    // Les contacts sont dans le noyau du hub (lot 36a) : toujours là.
    { key: "contact", action: "link", href: "/contacts?nouveau=1", contextual: false } as const,
    ...(modules.events && modules.quotes ? [{ key: "quote", action: "dialog", contextual: true } as const] : []),
    ...(modules.events && modules.budget ? [{ key: "expense", action: "dialog", contextual: true } as const] : []),
  ];
}
