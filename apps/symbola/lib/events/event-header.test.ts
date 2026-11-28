// Lot 72d (EVT-02, EVT-05 ; E1, E2, J9) — l'action de l'en-tête de la fiche et la frise en lecture.
import { describe, expect, it } from "vitest";
import { eventTimeline, headerAction } from "./event-header";

const at = (iso: string) => new Date(iso);

describe("EVT-02 — « Ouvrir le Jour J » est l'action de l'en-tête de J-N au lendemain inclus (J9)", () => {
  const wedding = { status: "confirmed" as const, eventDate: "2027-06-12", timeZone: "Europe/Paris" };

  it("N = 7 : J-8 « Écrire », J-7, J et J+1 « Ouvrir le Jour J », J+2 « Écrire »", () => {
    expect(headerAction(wedding, 7, at("2027-06-04T10:00:00Z"))).toBe("write");
    expect(headerAction(wedding, 7, at("2027-06-05T10:00:00Z"))).toBe("day_of");
    expect(headerAction(wedding, 7, at("2027-06-12T10:00:00Z"))).toBe("day_of");
    expect(headerAction(wedding, 7, at("2027-06-13T10:00:00Z"))).toBe("day_of");
    expect(headerAction(wedding, 7, at("2027-06-14T10:00:00Z"))).toBe("write");
  });

  it("N = 14 : J-15 « Écrire », J-14 « Ouvrir le Jour J »", () => {
    expect(headerAction(wedding, 14, at("2027-05-28T10:00:00Z"))).toBe("write");
    expect(headerAction(wedding, 14, at("2027-05-29T10:00:00Z"))).toBe("day_of");
  });

  it("les jours se comptent dans le fuseau de l'évènement : 23 h 30 à Paris est déjà J-7, pas à Montréal", () => {
    // 4 juin 2027, 22 h 30 UTC : le 5 à 0 h 30 à Paris (J-7), le 4 à 18 h 30 à Montréal (J-8).
    const instant = at("2027-06-04T22:30:00Z");
    expect(headerAction(wedding, 7, instant)).toBe("day_of");
    expect(headerAction({ ...wedding, timeZone: "America/Montreal" }, 7, instant)).toBe("write");
  });

  it("une demande, un évènement sans date, reporté ou annulé : jamais « Ouvrir le Jour J »", () => {
    const now = at("2027-06-12T10:00:00Z");
    expect(headerAction({ ...wedding, status: "option" }, 7, now)).toBe("write");
    expect(headerAction({ ...wedding, eventDate: null }, 7, now)).toBe("write");
    expect(headerAction({ ...wedding, status: "postponed" }, 7, now)).toBe("write");
    expect(headerAction({ ...wedding, status: "cancelled" }, 7, now)).toBe("write");
  });

  it("clôturé dès le lendemain : l'écran du jour J reste l'action jusqu'au lendemain inclus", () => {
    expect(headerAction({ ...wedding, status: "closed" }, 7, at("2027-06-13T10:00:00Z"))).toBe("day_of");
  });
});

describe("EVT-05 — La frise se lit : quatre étapes, une ligne d'état pour reporté, annulé, archivé (E1, E2)", () => {
  const base = { dates: { option: "2027-03-12", confirmed: "2027-04-02" }, eventDate: "2027-06-12", postponedFromDate: null, archived: false, closingDue: false };

  it("une demande : l'étape en cours dit depuis quand, le geste est « Le contrat est signé… »", () => {
    const view = eventTimeline({ ...base, status: "option", phase: "option", dates: { option: "2027-03-12" } });
    expect(view.line).toBeNull();
    expect(view.steps.map((step) => [step.step, step.state, step.date])).toEqual([
      ["request", "current", "2027-03-12"],
      ["signed", "upcoming", null],
      ["day_of", "upcoming", "2027-06-12"],
      ["closed", "upcoming", null],
    ]);
    expect(view.gesture).toBe("sign");
  });

  it("signé : la demande franchie garde sa date, aucun geste avant le lendemain du jour J", () => {
    const view = eventTimeline({ ...base, status: "confirmed", phase: "confirmed" });
    expect(view.current).toBe("signed");
    expect(view.steps[0]).toEqual({ step: "request", state: "passed", date: "2027-03-12" });
    expect(view.steps[1]).toEqual({ step: "signed", state: "current", date: "2027-04-02" });
    expect(view.gesture).toBeNull();
  });

  it("le jour même, « Jour J » vient seul ; le lendemain, « Clôturer l'évènement… »", () => {
    expect(eventTimeline({ ...base, status: "confirmed", phase: "day_of" })).toMatchObject({ current: "day_of", gesture: null });
    expect(eventTimeline({ ...base, status: "confirmed", phase: "confirmed", closingDue: true })).toMatchObject({ current: "signed", gesture: "close" });
  });

  it("aucune étape « En préparation » : signé et en préparation ne font qu'une étape", () => {
    expect(eventTimeline({ ...base, status: "confirmed", phase: "confirmed" }).steps.map((step) => step.step)).toEqual(["request", "signed", "day_of", "closed"]);
  });

  it("reporté, annulé, archivé : la ligne d'état, sans frise ni geste", () => {
    expect(eventTimeline({ ...base, status: "postponed", phase: "postponed", postponedFromDate: "2027-06-12" })).toMatchObject({ line: { kind: "postponed", previousDate: "2027-06-12" }, current: null, gesture: null });
    expect(eventTimeline({ ...base, status: "cancelled", phase: "cancelled", dates: { cancelled: "2026-11-25" } })).toMatchObject({ line: { kind: "cancelled", date: "2026-11-25" }, gesture: null });
    expect(eventTimeline({ ...base, status: "closed", phase: "closed", archived: true })).toMatchObject({ line: { kind: "archived" }, gesture: null });
  });
});
