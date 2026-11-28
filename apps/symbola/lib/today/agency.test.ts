// Lot 72c (PAR-10, HUB-03, HUB-08 ; C-14, A7, J4 ; spécification du lot 72, § 5.3) — « Moi · L'agence », sans
// base : la bascule n'existe que dans une agence ; « Moi » par défaut, le dernier choix gardé sur l'appareil ;
// la vue d'agence (une ligne par personne, « Attendu des mariés ou d'un prestataire », les évènements avec un
// retard en tête, les autres repliés) ; ses sommes sont celles du titre.
import { describe, expect, it } from "vitest";
import type { AgencyOverview, EventSummary } from "@symbola/contracts";
import type { TaskMemberOption } from "@/app/events/[id]/task-responsible";
import { agencyView, homeScope, meEvents } from "./agency";

const NADIA = "00000000-0000-4000-8000-000000000001";
const HUGO = "00000000-0000-4000-8000-000000000002";
const LINA = "00000000-0000-4000-8000-000000000003";
const GONE = "00000000-0000-4000-8000-000000000004";
const STRANGER = "00000000-0000-4000-8000-000000000009";

const members: TaskMemberOption[] = [
  { id: NADIA, name: "Nadia Belkacem", initials: "NB", me: true, removed: false },
  { id: HUGO, name: "Hugo Lemaire", initials: "HL", me: false, removed: false },
  { id: LINA, name: "Lina Morel", initials: "LM", me: false, removed: false },
  { id: GONE, name: "Marc Vasseur", initials: "MV", me: false, removed: true },
];

function event(id: string, eventDate: string | null): EventSummary {
  return { id, name: null, eventDate, status: "confirmed", clients: [], isDemo: false } as unknown as EventSummary;
}

const events = [event("e1", "2027-01-09"), event("e2", "2027-01-23"), event("e3", "2026-12-12"), event("e4", "2027-03-01"), event("e5", null)];
const leads = new Map([
  ["e1", HUGO],
  ["e2", LINA],
  ["e3", HUGO],
  ["e4", NADIA],
]);

const overview: AgencyOverview = {
  byWho: [
    { who: `member:${NADIA}`, late: 3, today: 1, horizon: 6 },
    { who: `member:${HUGO}`, late: 5, today: 2, horizon: 9 },
    { who: `member:${GONE}`, late: 1, today: 0, horizon: 1 },
    { who: `member:${STRANGER}`, late: 2, today: 0, horizon: 2 },
    { who: "nobody", late: 1, today: 0, horizon: 3 },
    { who: "clients", late: 2, today: 0, horizon: 5 },
    { who: "vendors", late: 1, today: 1, horizon: 6 },
  ],
  byEvent: [
    { eventId: "e1", done: 32, total: 42, late: 4, oldestLate: { label: "Faire signer le contrat du photographe", dueDate: "2026-11-02" } },
    { eventId: "e2", done: 28, total: 40, late: 4, oldestLate: { label: "Envoyer le plan de table", dueDate: "2026-11-10" } },
    { eventId: "e3", done: 25, total: 41, late: 3, oldestLate: { label: "Réserver la navette", dueDate: "2026-11-20" } },
    { eventId: "e4", done: 40, total: 40, late: 0, oldestLate: null },
  ],
  followedBy: { [NADIA]: 1, [HUGO]: 2, [LINA]: 1 },
};

describe("PAR-10, J4 — La bascule « Moi · L'agence » (lot 72c, critère 1)", () => {
  it("n'existe pas pour une planner seule, même avec ?vue=agence ou le cookie : la vue « Moi », sans erreur", () => {
    expect(homeScope({ vue: "agence", cookie: "agence", activeMembers: 1 })).toEqual({ toggle: false, scope: "me", remember: null });
    expect(homeScope({ vue: undefined, cookie: undefined, activeMembers: 0 })).toEqual({ toggle: false, scope: "me", remember: null });
  });

  it("existe dès qu'un second membre est actif ; « Moi » par défaut", () => {
    expect(homeScope({ vue: undefined, cookie: undefined, activeMembers: 2 })).toEqual({ toggle: true, scope: "me", remember: null });
  });

  it("?vue=agence et ?vue=moi choisissent et se gardent ; sans choix dans l'adresse, le dernier choix de l'appareil", () => {
    expect(homeScope({ vue: "agence", cookie: undefined, activeMembers: 6 })).toEqual({ toggle: true, scope: "agency", remember: "agency" });
    expect(homeScope({ vue: "moi", cookie: "agence", activeMembers: 6 })).toEqual({ toggle: true, scope: "me", remember: "me" });
    expect(homeScope({ vue: undefined, cookie: "agence", activeMembers: 6 })).toEqual({ toggle: true, scope: "agency", remember: null });
    expect(homeScope({ vue: undefined, cookie: "n'importe quoi", activeMembers: 6 }).scope).toBe("me");
  });

  it("la vue du calendrier (?vue=semaine, ?vue=mois) est celle de « Moi »", () => {
    expect(homeScope({ vue: "semaine", cookie: "agence", activeMembers: 6 }).scope).toBe("me");
    expect(homeScope({ vue: "mois", cookie: "agence", activeMembers: 6 }).scope).toBe("me");
  });
});

describe("HUB-08, J3 — « Mes évènements » dans la vue « Moi » (lot 72c)", () => {
  it("les évènements dont on est planner principal, ceux sans planner principal, et ceux d'une ligne qui nous revient", () => {
    const scoped = [{ eventId: "e2" }, { eventId: null }];
    expect(meEvents(events, { userId: NADIA, activeMembers: 3, leads }, scoped).map((entry) => entry.id)).toEqual(["e2", "e4", "e5"]);
  });

  it("seule, tous", () => {
    expect(meEvents(events, { userId: NADIA, activeMembers: 1, leads }, [])).toHaveLength(5);
  });
});

describe("PAR-10 — La vue « L'agence » (lot 72c, critères 2, 3 et 5)", () => {
  const view = agencyView({ overview, members, events, leads, plannerFilter: null, showUpToDate: false });

  it("une ligne par membre actif, la personne en tête avec « (vous) », « Voir ses tâches » vers « Tâches » filtré et groupé par évènement", () => {
    expect(view.people.map((person) => [person.name, person.me, person.late, person.today, person.horizon, person.followed])).toEqual([
      ["Nadia Belkacem", true, 3, 1, 6, 1],
      ["Hugo Lemaire", false, 5, 2, 9, 2],
      ["Lina Morel", false, 0, 0, 0, 1],
      ["Marc Vasseur", false, 1, 0, 1, 0],
    ]);
    expect(view.people[1]!.href).toBe(`/taches?qui=${HUGO}&grouper=evenement`);
  });

  it("un accès retiré n'a sa ligne que s'il lui reste des tâches", () => {
    const quiet = agencyView({ overview: { ...overview, byWho: overview.byWho.filter((row) => row.who !== `member:${GONE}`) }, members, events, leads, plannerFilter: null, showUpToDate: false });
    expect(quiet.people.map((person) => person.name)).not.toContain("Marc Vasseur");
  });

  it("« Attendu des mariés ou d'un prestataire » réunit mariés et prestataires ; « Sans personne » réunit ce qui n'a personne de l'équipe", () => {
    expect(view.expected).toEqual({ late: 3, today: 1, horizon: 11 });
    expect(view.nobody).toEqual({ late: 3, today: 0, horizon: 5 });
  });

  it("critère 2 : la somme de la colonne « En retard » est le nombre du titre ; le titre compte les évènements en retard", () => {
    const sum = view.people.reduce((total, person) => total + person.late, 0) + view.expected.late + (view.nobody?.late ?? 0);
    expect(view.late).toBe(sum);
    expect(view.late).toBe(15);
    expect(view.lateEvents).toBe(3);
  });

  it("par évènement : les retards en tête, du plus grand nombre au plus petit, puis la date la plus proche ; les évènements à jour repliés", () => {
    expect(view.withDelay.map((row) => row.event.id)).toEqual(["e1", "e2", "e3"]);
    expect(view.withDelay[0]).toMatchObject({ done: 32, total: 42, late: 4, leadName: "Hugo Lemaire", oldestLate: { label: "Faire signer le contrat du photographe" } });
    expect(view.upToDateCount).toBe(2);
    // Repliés : aucune ligne montée tant qu'on ne les affiche pas (critère 5).
    expect(view.upToDate).toEqual([]);
    const shown = agencyView({ overview, members, events, leads, plannerFilter: null, showUpToDate: true });
    expect(shown.upToDate.map((row) => [row.event.id, row.done, row.total])).toEqual([["e4", 40, 40], ["e5", 0, 0]]);
  });

  it("le filtre « Planner principal » filtre la table, pas le titre ; une valeur inconnue est ignorée", () => {
    const hugo = agencyView({ overview, members, events, leads, plannerFilter: HUGO, showUpToDate: false });
    expect(hugo.withDelay.map((row) => row.event.id)).toEqual(["e1", "e3"]);
    expect(hugo.upToDateCount).toBe(0);
    expect(hugo.late).toBe(view.late);
    expect(hugo.plannerFilter).toBe(HUGO);
    expect(view.leadOptions.map((option) => option.name)).toEqual(["Nadia Belkacem", "Hugo Lemaire", "Lina Morel"]);
    const unknown = agencyView({ overview, members, events, leads, plannerFilter: STRANGER, showUpToDate: false });
    expect(unknown.plannerFilter).toBeNull();
    expect(unknown.withDelay).toHaveLength(3);
  });
});
