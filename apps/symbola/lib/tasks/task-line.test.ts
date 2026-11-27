import { describe, expect, it } from "vitest";
import { buildTaskLine, dueWords, lineParts, nameInitials, TASK_LINE_FORMS, type TaskLineSource } from "./task-line";

// Traducteur de test : la clé, et ses valeurs s'il y en a.
const t = (key: string, values?: Record<string, string | number>) => (values ? `${key}:${JSON.stringify(values)}` : key);

const ME = "00000000-0000-4000-8000-000000000001";
const BASTIEN = "00000000-0000-4000-8000-000000000002";
const EVENT = "00000000-0000-4000-8000-0000000000e1";
const VENDOR = "00000000-0000-4000-8000-0000000000f1";

function task(changes: Partial<TaskLineSource> = {}): TaskLineSource {
  return {
    id: "00000000-0000-4000-8000-0000000000a1",
    eventId: EVENT,
    event: { id: EVENT, names: "Léa & Maxime" },
    label: "Confirmer la voiture des mariés",
    dueDate: "2026-11-21",
    responsible: "planner",
    vendorCandidateId: null,
    assigneeUserId: BASTIEN,
    priority: "normal",
    done: false,
    dueState: { kind: "late", days: 4 },
    ...changes,
  };
}

const context = {
  t,
  formatDate: (date: string) => `jour ${date}`,
  members: [
    { id: ME, name: "Camille Roux", shortName: "Camille", initials: "CR", me: true, removed: false },
    { id: BASTIEN, name: "Bastien Leroy", shortName: "Bastien", initials: "BL", me: false, removed: false },
  ],
  vendorName: (id: string) => (id === VENDOR ? "Maison Lumen" : null),
  clientsLabel: () => "Les mariés",
  href: (source: TaskLineSource) => `/taches?tache=${source.id}`,
  eventHref: (eventId: string) => `/events/${eventId}?onglet=taches`,
};

describe("CHR-02, CHR-03, UX-05 — La ligne type d'une tâche (lot 70c)", () => {
  it("donne les mêmes informations, dans le même ordre, pour les quatre formes : titre, évènement, échéance, qui s'en charge, Fait", () => {
    const line = buildTaskLine(task(), context);
    expect(line.label).toBe("Confirmer la voiture des mariés");
    expect(line.event).toEqual({ names: "Léa & Maxime", href: `/events/${EVENT}?onglet=taches` });
    expect(line.dateLabel).toBe("jour 2026-11-21");
    expect(line.due).toEqual({ kind: "late", text: 'dueLate:{"days":4}', icon: "late" });
    expect(line.who).toEqual({ name: "Bastien", initials: "BL" });
    expect(line.href).toBe(`/taches?tache=${line.id}`);
    // Le téléphone est la même ligne, rangée sur trois étages par la feuille de style.
    expect(TASK_LINE_FORMS).toEqual(["list", "event", "today"]);
  });

  it("la fiche n'a pas la colonne Évènement ; « Aujourd'hui » n'a pas de menu et son nom de mariage est un lien séparé", () => {
    expect(lineParts("list")).toEqual({ eventColumn: true, eventLink: false, menu: true });
    expect(lineParts("event")).toEqual({ eventColumn: false, eventLink: false, menu: true });
    expect(lineParts("today")).toEqual({ eventColumn: true, eventLink: true, menu: false });
  });

  it("une tâche hors évènement dit « Hors évènement »", () => {
    const line = buildTaskLine(task({ eventId: null, event: null }), context);
    expect(line.event).toBeNull();
    expect(line.eventLabel).toBe("noEvent");
  });

  it("nomme la personne : « Vous », le prénom d'un collègue, les mariés par le mot du type, le prestataire par son nom", () => {
    expect(buildTaskLine(task({ assigneeUserId: ME }), context).who).toEqual({ name: "you", initials: "CR" });
    expect(buildTaskLine(task({ responsible: "clients", assigneeUserId: null }), context).who).toEqual({ name: "Les mariés", initials: "M" });
    expect(buildTaskLine(task({ responsible: "vendor", vendorCandidateId: VENDOR, assigneeUserId: null }), context).who).toEqual({ name: "Maison Lumen", initials: "ML" });
    expect(buildTaskLine(task({ assigneeUserId: null }), context).who).toEqual({ name: "nobody", initials: null });
  });

  it("garde la priorité en mot et icône neutres (A6)", () => {
    expect(buildTaskLine(task({ priority: "high" }), context).priority).toBe(true);
    expect(buildTaskLine(task(), context).priority).toBe(false);
  });

  it("initiales : les deux premiers mots, sans l'article", () => {
    expect(nameInitials("Les mariés")).toBe("M");
    expect(nameInitials("Maison Lumen")).toBe("ML");
    expect(nameInitials("l'Atelier Pivoine")).toBe("AP");
    expect(nameInitials("")).toBe("?");
  });
});

describe("UX-06, UX-05 — L'état d'une échéance se lit sans la couleur (lot 70c)", () => {
  it("chaque état a son mot ; le retard et le délai ont une icône", () => {
    expect(dueWords({ kind: "late", days: 5 }, t)).toEqual({ kind: "late", text: 'dueLate:{"days":5}', icon: "late" });
    expect(dueWords({ kind: "today" }, t)).toEqual({ kind: "today", text: "dueToday", icon: "clock" });
    expect(dueWords({ kind: "tomorrow" }, t)).toEqual({ kind: "tomorrow", text: "dueTomorrow", icon: "clock" });
    expect(dueWords({ kind: "soon", days: 4 }, t)).toEqual({ kind: "soon", text: 'dueSoon:{"days":4}', icon: "clock" });
  });

  it("plus tard : la date seule, sans mot d'état ; une tâche faite n'a pas d'état", () => {
    expect(dueWords({ kind: "later", days: 30 }, t)).toBeNull();
    expect(dueWords(null, t)).toBeNull();
  });

  it("seul un vrai retard est marqué « late » (le rouge ne sert qu'à lui)", () => {
    const kinds = [{ kind: "today" }, { kind: "tomorrow" }, { kind: "soon", days: 3 }] as const;
    for (const state of kinds) expect(dueWords(state, t)?.kind).not.toBe("late");
  });
});
