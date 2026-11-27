import { describe, expect, it } from "vitest";
import { addParisDays, followUpStopReason, FollowUpSettingsInvalidError, nextFollowUpToPrepare, validateFollowUpSteps, withOptOut, type FollowUpFacts } from "./follow-up-rules";

const steps = [
  { days: 3, messageTemplateId: null },
  { days: 7, messageTemplateId: null },
];
const anchorAt = new Date("2027-03-01T09:00:00.000Z"); // lundi 1er mars, 10 h à Paris

function facts(overrides: Partial<FollowUpFacts> = {}): FollowUpFacts {
  return { status: "option", anchorAt, lastAnsweredAt: null, stoppedAt: null, lastStageChangeAt: null, lastProspectActionAt: null, lastPlannerMessageAt: anchorAt, ...overrides };
}

describe("CRM-06 — Relances réglables, préparées à J+3 et J+7 (horloge simulée)", () => {
  it("la première relance se prépare à J+3, pas la veille ; la seconde attend que la première soit partie", () => {
    expect(nextFollowUpToPrepare(steps, anchorAt, new Date("2027-03-04T08:59:59.000Z"), [])).toBeNull();
    expect(nextFollowUpToPrepare(steps, anchorAt, new Date("2027-03-04T09:00:00.000Z"), [])).toEqual({ rank: 1, readyAt: new Date("2027-03-04T09:00:00.000Z") });
    const pending = [{ rank: 1, sentAt: null, stoppedAt: null, stopReason: null }];
    expect(nextFollowUpToPrepare(steps, anchorAt, new Date("2027-03-09T12:00:00.000Z"), pending)).toBeNull();
    const sent = [{ rank: 1, sentAt: new Date("2027-03-04T10:00:00.000Z"), stoppedAt: null, stopReason: null }];
    expect(nextFollowUpToPrepare(steps, anchorAt, new Date("2027-03-08T08:59:00.000Z"), sent)).toBeNull();
    expect(nextFollowUpToPrepare(steps, anchorAt, new Date("2027-03-08T09:00:00.000Z"), sent)).toEqual({ rank: 2, readyAt: new Date("2027-03-08T09:00:00.000Z") });
  });

  it("le passage à l'heure d'été ne décale pas l'heure de Paris de la relance", () => {
    // Envoi le vendredi 26 mars 2027 à 10 h (UTC+1) ; heure d'été le dimanche 28 ; J+3 = lundi 29 à 10 h (UTC+2).
    const friday = new Date("2027-03-26T09:00:00.000Z");
    expect(addParisDays(friday, 3).toISOString()).toBe("2027-03-29T08:00:00.000Z");
    expect(nextFollowUpToPrepare(steps, friday, new Date("2027-03-29T07:59:00.000Z"), [])).toBeNull();
    expect(nextFollowUpToPrepare(steps, friday, new Date("2027-03-29T08:00:00.000Z"), [])?.rank).toBe(1);
  });

  it("une relance retirée par la planner laisse venir la suivante ; une relance arrêtée par un fait clôt la série", () => {
    const withdrawn = [{ rank: 1, sentAt: null, stoppedAt: new Date(), stopReason: "withdrawn" as const }];
    expect(nextFollowUpToPrepare(steps, anchorAt, new Date("2027-03-08T09:00:00.000Z"), withdrawn)?.rank).toBe(2);
    const answered = [{ rank: 1, sentAt: null, stoppedAt: new Date(), stopReason: "answered" as const }];
    expect(nextFollowUpToPrepare(steps, anchorAt, new Date("2027-03-20T09:00:00.000Z"), answered)).toBeNull();
    const all = [
      { rank: 1, sentAt: new Date(), stoppedAt: null, stopReason: null },
      { rank: 2, sentAt: new Date(), stoppedAt: null, stopReason: null },
    ];
    expect(nextFollowUpToPrepare(steps, anchorAt, new Date("2027-04-20T09:00:00.000Z"), all)).toBeNull();
  });

  it("aucune relance n'est prévue sans réglage (liste vide)", () => {
    expect(nextFollowUpToPrepare([], anchorAt, new Date("2027-05-01T09:00:00.000Z"), [])).toBeNull();
  });

  it("le réglage accepte trois relances au plus, dans l'ordre, de 1 à 60 jours", () => {
    expect(validateFollowUpSteps(steps)).toEqual(steps);
    expect(() => validateFollowUpSteps([...steps, { days: 10, messageTemplateId: null }, { days: 14, messageTemplateId: null }])).toThrow(FollowUpSettingsInvalidError);
    expect(() => validateFollowUpSteps([{ days: 0, messageTemplateId: null }])).toThrow(/days/);
    expect(() => validateFollowUpSteps([{ days: 7, messageTemplateId: null }, { days: 3, messageTemplateId: null }])).toThrow(/order/);
  });
});

describe("CRM-06 — Aucune relance après une réponse ou un refus (D3)", () => {
  it("rien n'arrête une relance sans fait nouveau depuis le dernier envoi", () => {
    expect(followUpStopReason(facts())).toBeNull();
    // Un fait antérieur au dernier envoi ne compte pas : le nouvel envoi repart à zéro.
    expect(followUpStopReason(facts({ lastAnsweredAt: new Date("2027-02-28T09:00:00.000Z"), lastProspectActionAt: new Date("2027-02-27T09:00:00.000Z") }))).toBeNull();
  });

  it("« a répondu », un changement d'étape, une confirmation, un refus, une action du prospect, un nouvel envoi l'arrêtent", () => {
    const later = new Date("2027-03-02T09:00:00.000Z");
    expect(followUpStopReason(facts({ lastAnsweredAt: later }))).toBe("answered");
    expect(followUpStopReason(facts({ lastStageChangeAt: later }))).toBe("stage_changed");
    expect(followUpStopReason(facts({ status: "confirmed" }))).toBe("confirmed");
    expect(followUpStopReason(facts({ status: "closed" }))).toBe("confirmed");
    expect(followUpStopReason(facts({ status: "cancelled" }))).toBe("lost");
    expect(followUpStopReason(facts({ lastProspectActionAt: later }))).toBe("prospect_action");
    expect(followUpStopReason(facts({ lastPlannerMessageAt: later }))).toBe("new_message");
  });

  it("« ne plus relancer » vaut pour toujours, même avant le dernier envoi", () => {
    expect(followUpStopReason(facts({ stoppedAt: new Date("2027-01-01T00:00:00.000Z") }))).toBe("stopped");
  });

  it("AV-9 : chaque relance porte la phrase « Répondez simplement », une seule fois", () => {
    const optOut = "Vous ne souhaitez plus de nouvelles ? Répondez simplement à ce message.";
    expect(withOptOut("Bonjour Léa,\r\n\r\nDes nouvelles ?", optOut)).toBe(`Bonjour Léa,\n\nDes nouvelles ?\n\n${optOut}`);
    expect(withOptOut(`Bonjour\n\n${optOut}`, optOut)).toBe(`Bonjour\n\n${optOut}`);
  });
});
