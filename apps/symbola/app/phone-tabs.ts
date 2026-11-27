// Lot 70f (UX-05, HUB-06, ARC-06 ; D4, A17 ; page 3 des maquettes du lot 68) — les entrées de la barre du
// bas du téléphone. Quatre places : Aujourd'hui, Évènements, Tâches, Prestataires ; « Plus » en
// cinquième porte le reste. Une entrée dont le module n'est pas souscrit laisse sa place à la première
// entrée disponible de « Plus » (Contacts, puis Rendez-vous, Devis et factures, Encaissements) : jamais
// une entrée « indisponible » dans la barre (A17, tranchée le 26/11). Les entrées montées de « Plus »
// (`promoted`) n'y sont plus répétées.
export type PhoneEntry = "today" | "events" | "tasks" | "vendors" | "contacts" | "appointments" | "quotes" | "payments";

export const PHONE_TAB_PLACES = 4;

export function phoneTabs(modules: { events: boolean; vendors: boolean; appointments: boolean; quotes: boolean }): { tabs: PhoneEntry[]; promoted: PhoneEntry[] } {
  const base: PhoneEntry[] = ["today", ...(modules.events ? (["events", "tasks"] as const) : []), ...(modules.vendors ? (["vendors"] as const) : [])];
  // L'ordre de « Plus » (maquette) ; les Contacts sont du noyau, toujours là.
  const more: PhoneEntry[] = ["contacts", ...(modules.appointments ? (["appointments"] as const) : []), ...(modules.quotes ? (["quotes", "payments"] as const) : [])];
  const promoted = more.slice(0, Math.max(0, PHONE_TAB_PLACES - base.length));
  return { tabs: [...base, ...promoted], promoted };
}
