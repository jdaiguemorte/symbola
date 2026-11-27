// Lot 72b (HUB-08, UX-01, UX-06, UX-13, PAR-03 ; spécification du lot 72, § 5.2 ; maquettes 13 et 14 du
// lot 68, choix A1 à A5 de la note 09) — les règles de l'écran « Aujourd'hui », sans base ni React.
//
// - La carte « À traiter en premier » porte toutes les lignes de l'horizon : les sept premières (M15) et le
//   reste, marqué, que « Tout afficher » montre sur place. La somme des lignes est le compte du haut (C-20).
// - L'état de l'accueil : vide (aucun évènement, hors exemple), au lendemain d'une reprise (aucun point, et
//   des mariages signés sans tâche : ni « tout est à jour », ni fausse urgence, C-15) ou rempli.
// - Le mot de « Mes évènements » : « 6 points, dont 2 en retard », « Pas encore de tâches », « À jour ».
// - Le contact d'une ligne : le téléphone qui appelle d'un toucher, ou l'e-mail ; sans rien, rien.
import type { EventSummary, TodayContact } from "@symbola/contracts";
import { HOME_FIRST_COUNT, type RankedItem, type RankedToday } from "./rank";
import { todayParts, type PartLink, type TodayNature } from "./parts";

export type CardLine = { item: RankedItem; rest: boolean };
export type CardPart = { nature: TodayNature; shown: number; total: number; lines: CardLine[]; link: PartLink };
export type TodayCard = { parts: CardPart[]; shown: number; rest: number };

export function todayCard(ranked: RankedToday, modules: { quotes: boolean; events: boolean }, count: number = HOME_FIRST_COUNT): TodayCard {
  // Les parties, leur ordre et leurs liens sont ceux du lot 72a, comptés sur toutes les lignes : une partie
  // qui n'a rien dans les sept premières vient après les autres (sa première ligne est plus loin).
  const parts = todayParts(ranked, modules, ranked.all.length);
  const first = new Set(ranked.all.slice(0, count).map((item) => item.key));
  const card = parts.map((part) => {
    const lines = part.items.map((item) => ({ item, rest: !first.has(item.key) }));
    return { nature: part.nature, shown: lines.filter((line) => !line.rest).length, total: part.total, lines, link: part.link };
  });
  const shown = Math.min(count, ranked.all.length);
  return { parts: card, shown, rest: ranked.all.length - shown };
}

export type HomeState = { kind: "empty" } | { kind: "filled" } | { kind: "quiet"; withoutTasks: string[] };

// « Signé, en préparation » sans aucune tâche : le cas d'un mariage repris (lot 71a : aucune ligne née d'un
// import) ou d'un mariage signé dont la liste n'est pas encore faite.
function signedWithoutTasks(event: EventSummary): boolean {
  return event.status === "confirmed" && event.taskProgress !== undefined && event.taskProgress.total === 0;
}

export function homeState(input: { eventsEnabled: boolean; events: readonly EventSummary[]; points: number }): HomeState {
  if (!input.eventsEnabled) return { kind: "filled" };
  const real = input.events.filter((event) => !event.isDemo);
  if (real.length === 0) return { kind: "empty" };
  if (input.points > 0) return { kind: "filled" };
  const withoutTasks = real
    .filter(signedWithoutTasks)
    .sort((a, b) => (a.eventDate ?? "9999-12-31").localeCompare(b.eventDate ?? "9999-12-31"))
    .map((event) => event.id);
  return withoutTasks.length > 0 ? { kind: "quiet", withoutTasks } : { kind: "filled" };
}

export type EventPointsWord = { kind: "points"; points: number; late: number } | { kind: "noTasks" } | { kind: "upToDate" };

export function eventPointsWord(input: { points: number; late: number; event: EventSummary }): EventPointsWord {
  if (input.points > 0) return { kind: "points", points: input.points, late: input.late };
  return signedWithoutTasks(input.event) ? { kind: "noTasks" } : { kind: "upToDate" };
}

export type ContactParts = { name: string; phone?: { text: string; href: string }; email?: { text: string; href: string } };

export function contactParts(contact: TodayContact | undefined): ContactParts | null {
  if (!contact) return null;
  if (contact.phone) return { name: contact.name, phone: { text: contact.phone, href: `tel:${contact.phone.replace(/[^\d+]/g, "")}` } };
  if (contact.email) return { name: contact.name, email: { text: contact.email, href: `mailto:${contact.email}` } };
  return null;
}

