// Lot 65c (HUB-08, UX-01 ; recette staging du 22/11/2026, maquette M15 retouchée par Julien) —
// « À traiter en premier » tient en sept lignes au plus, triées par priorité puis par délai, et se
// découpe par nature : tout ce qui remonte n'est pas une tâche. Chaque partie dit son nombre (tous les
// éléments de cette nature, pas seulement ceux montrés) et mène à sa page quand elle existe. Une partie
// sans ligne parmi les sept n'apparaît pas ; l'ordre des parties suit leur élément le plus urgent.
// Règles pures, sans base. Lot 72a (A1, M15) : chaque partie dit combien elle montre sur combien
// (« Tâches 4 sur 7 ») ; ce qui ne tient pas dans la carte est rendu à part (« Tout afficher »), et la
// somme des deux est le compte du haut. Une alerte du radar est une ligne « À regarder ».
import { HOME_FIRST_COUNT, type RankedItem, type RankedToday, type TodayItemKind } from "./rank";

export { HOME_FIRST_COUNT };

export const TODAY_NATURES = ["follow_ups", "tasks", "payments", "decisions", "prospects", "watch", "others"] as const;
export type TodayNature = (typeof TODAY_NATURES)[number];

const NATURE: Record<TodayItemKind, TodayNature> = {
  task: "tasks",
  client_task: "tasks",
  quote_follow_up: "follow_ups",
  prospect_follow_up: "follow_ups",
  prospect_follow_up_ready: "follow_ups",
  vendor_contract: "follow_ups",
  vendor_roadmap: "follow_ups",
  link_renewal: "follow_ups",
  // Lot 65d (ADR 0110) : les messages « À envoyer » sont des relances, au sens de M15.
  email_to_send: "follow_ups",
  client_payment: "payments",
  vendor_payment: "payments",
  payment_declaration: "payments",
  transfer_declaration: "payments",
  deposit_blocked: "payments",
  vendor_bank_check: "payments",
  decision: "decisions",
  vendor_choice: "decisions",
  vendor_answer: "decisions",
  vendor_document: "decisions",
  questionnaire_finished: "decisions",
  prospect_request: "prospects",
  prospect_review: "prospects",
  contact_duplicates: "prospects",
  date_conflict: "others",
  guest_purge: "others",
  guest_opposition: "others",
  appointment: "others",
  appointment_change: "others",
  calendar_source_error: "others",
  closing_due: "others",
  watch: "watch",
};

export function natureOf(kind: TodayItemKind): TodayNature {
  return NATURE[kind];
}

// La page d'une partie : une page qui liste ces éléments, ou l'évènement quand ils sont tous du même ;
// sinon aucune (chaque ligne garde son propre lien).
export type PartLink = { kind: "tasks" | "payments" | "pipeline" | "event"; href: string } | null;

// shown : les lignes de cette nature dans la carte ; total : toutes celles de l'horizon.
export type TodayPart = { nature: TodayNature; shown: number; total: number; items: RankedItem[]; link: PartLink };

function linkOf(nature: TodayNature, all: RankedItem[], modules: { quotes: boolean; events: boolean }): PartLink {
  if (nature === "tasks" && modules.events) return { kind: "tasks", href: "/taches" };
  if (nature === "payments" && modules.quotes) return { kind: "payments", href: "/devis/encaissements" };
  if (nature === "prospects" && modules.events) return { kind: "pipeline", href: "/events/pipeline" };
  if (nature === "follow_ups" || nature === "decisions") {
    const events = new Set(all.map((item) => item.eventId));
    const [only] = [...events];
    if (events.size === 1 && only) return { kind: "event", href: `/events/${only}` };
  }
  return null;
}

export function todayParts(ranked: RankedToday, modules: { quotes: boolean; events: boolean }, count: number = HOME_FIRST_COUNT): TodayPart[] {
  const shown = ranked.all.slice(0, count);
  const order: TodayNature[] = [];
  for (const item of shown) {
    const nature = natureOf(item.kind);
    if (!order.includes(nature)) order.push(nature);
  }
  return order.map((nature) => {
    const all = ranked.all.filter((item) => natureOf(item.kind) === nature);
    const items = shown.filter((item) => natureOf(item.kind) === nature);
    return { nature, shown: items.length, total: all.length, items, link: linkOf(nature, all, modules) };
  });
}

// Lot 72a (M15) : les lignes qui ne tiennent pas dans la carte, pour « N autres points · Tout afficher ».
export function todayRest(ranked: RankedToday, count: number = HOME_FIRST_COUNT): RankedItem[] {
  return ranked.all.slice(count);
}
