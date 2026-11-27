// Lot 72b (HUB-08, UX-01, UX-06, UX-13, PAR-03 ; spécification du lot 72, § 5.2 ; maquettes 13 et 14 du
// lot 68) — les règles de l'écran « Aujourd'hui », sans base : la carte et son « Tout afficher », l'état
// de l'accueil (vide, rempli, au lendemain d'une reprise), le mot de « Mes évènements », le contact.
import { describe, expect, it } from "vitest";
import type { EventSummary } from "@symbola/contracts";
import { rankToday, type TodayItem, type TodayItemKind } from "./rank";
import { contactParts, eventPointsWord, homeState, todayCard } from "./home";

const TODAY = "2026-11-25";
const item = (key: string, kind: TodayItemKind, dueOn: string | null, eventId: string | null = "e1"): TodayItem => ({
  key,
  kind,
  eventId,
  eventNames: null,
  title: key,
  dueOn,
  since: null,
  actor: { kind: "you" },
  href: `/x/${key}`,
});
const modules = { quotes: true, events: true };

const event = (id: string, status: EventSummary["status"], extra: Partial<EventSummary> = {}): EventSummary => ({
  id,
  status,
  phase: status,
  eventDate: "2027-06-12",
  timeZone: "Europe/Paris",
  venueName: null,
  venueCity: null,
  clients: [],
  isDemo: false,
  ...extra,
});

// Nadia (maquette 14) : onze points, dont sept dans la carte ; 7 + 4 = 11.
const nadia = () =>
  rankToday(
    [
      ...["2026-10-30", "2026-11-01", "2026-11-08", "2026-11-16"].map((date, index) => item(`late-${index}`, "task", date)),
      item("solde", "client_payment", "2026-11-24"),
      item("acompte", "client_payment", "2026-11-30"),
      item("dj", "vendor_contract", null),
      item("t5", "task", "2026-12-01"),
      item("t6", "task", "2026-12-02"),
      item("t7", "task", "2026-12-04"),
      item("p3", "client_payment", "2026-12-05"),
    ],
    TODAY,
  );

describe("HUB-08 — « À traiter en premier » et « Tout afficher » : la somme des lignes est le compte du haut (lot 72b, critère 4)", () => {
  it("sept lignes au plus dans la carte ; le reste est dans la même carte, marqué « reste », et 7 + 4 = 11", () => {
    const ranked = nadia();
    const card = todayCard(ranked, modules);
    expect(ranked.points).toBe(11);
    expect(card.shown).toBe(7);
    expect(card.rest).toBe(4);
    const lines = card.parts.flatMap((part) => part.lines);
    expect(lines).toHaveLength(ranked.points);
    expect(lines.filter((line) => !line.rest)).toHaveLength(7);
    expect(lines.map((line) => line.item.key).sort()).toEqual(ranked.all.map((entry) => entry.key).sort());
  });

  it("chaque partie dit combien elle montre sur combien : « Tâches 4 sur 7 », « Paiements 2 sur 3 », « Relances 1 »", () => {
    const parts = todayCard(nadia(), modules).parts;
    expect(parts.map((part) => [part.nature, part.shown, part.total])).toEqual([
      ["tasks", 4, 7],
      ["payments", 2, 3],
      ["follow_ups", 1, 1],
    ]);
  });

  it("l'ordre des parties suit leur première ligne ; une partie qui n'a que des lignes du reste vient après, cachée tant que la carte est courte", () => {
    const ranked = rankToday([...Array.from({ length: 7 }, (_, index) => item(`t${index}`, "task", `2026-11-2${index}`)), item("d", "decision", "2026-12-08")], TODAY);
    const parts = todayCard(ranked, modules).parts;
    expect(parts.map((part) => part.nature)).toEqual(["tasks", "decisions"]);
    expect(parts[1]!.shown).toBe(0);
    expect(parts[1]!.lines.every((line) => line.rest)).toBe(true);
  });

  it("aucun reste quand tout tient : « 7 points », pas de « Tout afficher »", () => {
    const ranked = rankToday(Array.from({ length: 5 }, (_, index) => item(`t${index}`, "task", `2026-11-2${index}`)), TODAY);
    const card = todayCard(ranked, modules);
    expect(card).toMatchObject({ shown: 5, rest: 0 });
    expect(card.parts[0]).toMatchObject({ shown: 5, total: 5 });
  });

  it("le lien d'une partie reste celui de sa page (« Tâches », « Encaissements ») ; un module non souscrit n'en donne pas (ARC-07)", () => {
    const parts = todayCard(nadia(), { quotes: false, events: true }).parts;
    expect(parts.find((part) => part.nature === "tasks")!.link).toEqual({ kind: "tasks", href: "/taches" });
    expect(parts.find((part) => part.nature === "payments")!.link).toBeNull();
  });
});

describe("HUB-08, UX-01 — Les trois états de l'accueil (lot 72b, critères 1 et 6)", () => {
  it("vide : aucun évènement, hors exemple ; l'exemple d'un essai guidé ne remplit pas l'espace", () => {
    expect(homeState({ eventsEnabled: true, events: [], points: 0 })).toEqual({ kind: "empty" });
    expect(homeState({ eventsEnabled: true, events: [event("demo", "confirmed", { isDemo: true })], points: 0 })).toEqual({ kind: "empty" });
  });

  it("sans le module Évènements, jamais l'état vide (rien à créer) : l'accueil reste rempli de ce que les autres modules apportent", () => {
    expect(homeState({ eventsEnabled: false, events: [], points: 0 })).toEqual({ kind: "filled" });
  });

  it("au lendemain d'une reprise : aucun point, et des mariages signés sans tâche ; ils sont nommés, le plus proche d'abord", () => {
    const quiet = homeState({
      eventsEnabled: true,
      events: [
        event("loin", "confirmed", { eventDate: "2027-06-12", taskProgress: { done: 0, total: 0, late: 0 } }),
        event("proche", "confirmed", { eventDate: "2027-03-20", taskProgress: { done: 0, total: 0, late: 0 } }),
        event("demande", "option", { taskProgress: { done: 0, total: 0, late: 0 } }),
      ],
      points: 0,
    });
    expect(quiet).toEqual({ kind: "quiet", withoutTasks: ["proche", "loin"] });
  });

  it("rempli dès qu'il y a un point, ou quand tous les mariages signés ont des tâches", () => {
    const signed = event("a", "confirmed", { taskProgress: { done: 0, total: 0, late: 0 } });
    expect(homeState({ eventsEnabled: true, events: [signed], points: 2 })).toEqual({ kind: "filled" });
    expect(homeState({ eventsEnabled: true, events: [event("b", "confirmed", { taskProgress: { done: 3, total: 9, late: 0 } })], points: 0 })).toEqual({ kind: "filled" });
  });
});

describe("UX-01, EVT-07 — « Mes évènements » répartit le même total (lot 72b ; maquette 13)", () => {
  it("« 6 points, dont 2 en retard », « 1 point », « Pas encore de tâches » (signé sans tâche), « À jour »", () => {
    expect(eventPointsWord({ points: 6, late: 2, event: event("a", "confirmed", { taskProgress: { done: 1, total: 9, late: 2 } }) })).toEqual({ kind: "points", points: 6, late: 2 });
    expect(eventPointsWord({ points: 1, late: 0, event: event("a", "option") })).toEqual({ kind: "points", points: 1, late: 0 });
    expect(eventPointsWord({ points: 0, late: 0, event: event("a", "confirmed", { taskProgress: { done: 0, total: 0, late: 0 } }) })).toEqual({ kind: "noTasks" });
    expect(eventPointsWord({ points: 0, late: 0, event: event("a", "confirmed", { taskProgress: { done: 4, total: 4, late: 0 } }) })).toEqual({ kind: "upToDate" });
    // Une demande sans tâche n'en attend pas encore : elle est à jour.
    expect(eventPointsWord({ points: 0, late: 0, event: event("a", "option", { taskProgress: { done: 0, total: 0, late: 0 } }) })).toEqual({ kind: "upToDate" });
  });
});

describe("UX-13 — Le contact sur la ligne : appeler d'un toucher (lot 72b, critère 7)", () => {
  it("le téléphone en lien « tel: » sans espaces ; l'e-mail en « mailto: » quand il n'y a pas de téléphone", () => {
    expect(contactParts({ name: "Karim Haddad", phone: "06 00 00 41 27", email: "karim@exemple.test" })).toEqual({ name: "Karim Haddad", phone: { text: "06 00 00 41 27", href: "tel:0600004127" } });
    expect(contactParts({ name: "Léa Martin", phone: "+33 6 00 00 18 52", email: null })).toMatchObject({ phone: { href: "tel:+33600001852" } });
    expect(contactParts({ name: "Léa Martin", phone: null, email: "lea@exemple.test" })).toEqual({ name: "Léa Martin", email: { text: "lea@exemple.test", href: "mailto:lea@exemple.test" } });
  });

  it("sans contact, rien (aucun « — »)", () => {
    expect(contactParts(undefined)).toBeNull();
    expect(contactParts({ name: "X", phone: null, email: null })).toBeNull();
  });
});
