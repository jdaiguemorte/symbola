// Lot 47 (PAR-05, PRE-03, PRE-04, BUD-05 ; D2, D3, D6, D8) — règles pures des prestataires par
// lien, avec une horloge simulée : relance la veille de la date limite, feuilles de route à J-30 et
// J-7 dans le fuseau de l'évènement, alerte sans confirmation, annulation du choix sous 7 jours,
// totaux des scénarios, étape montrée par le lien.
import { describe, expect, it } from "vitest";
import { starterVendorCoordination } from "@symbola/starter-templates";
import {
  briefReminderDue,
  canUndoEngagement,
  compareByAmount,
  isVendorSendingHour,
  roadmapAlertDue,
  roadmapStageDue,
  scenarioTotals,
  vendorLinkStage,
  vendorCanAnswer,
} from "./vendor-coordination-rules";

const policy = starterVendorCoordination();

describe("PAR-05 (D2) — Relance la veille de la date limite", () => {
  it("part la veille de la date limite", () => {
    expect(briefReminderDue("2027-03-10", "2027-03-09", policy)).toBe(true);
  });

  it("est rattrapée le jour même de la date limite (panne de la veille)", () => {
    expect(briefReminderDue("2027-03-10", "2027-03-10", policy)).toBe(true);
  });

  it("ne part ni avant la veille, ni après la date limite", () => {
    expect(briefReminderDue("2027-03-10", "2027-03-08", policy)).toBe(false);
    expect(briefReminderDue("2027-03-10", "2027-03-11", policy)).toBe(false);
  });
});

describe("PAR-05 (D8) — Feuille de route à J-30 et J-7, dans le fuseau de l'évènement", () => {
  const enabled = { month: true, week: true };

  it("J-30 part trente jours avant, puis se rattrape jusqu'à la veille de J-7", () => {
    expect(roadmapStageDue("2027-06-12", "2027-05-13", enabled, policy)).toBe("j30");
    expect(roadmapStageDue("2027-06-12", "2027-06-04", enabled, policy)).toBe("j30");
    expect(roadmapStageDue("2027-06-12", "2027-05-12", enabled, policy)).toBeNull();
  });

  it("J-7 part sept jours avant, puis se rattrape jusqu'à la veille de l'évènement", () => {
    expect(roadmapStageDue("2027-06-12", "2027-06-05", enabled, policy)).toBe("j7");
    expect(roadmapStageDue("2027-06-12", "2027-06-11", enabled, policy)).toBe("j7");
  });

  it("rien le jour même ni après l'évènement", () => {
    expect(roadmapStageDue("2027-06-12", "2027-06-12", enabled, policy)).toBeNull();
    expect(roadmapStageDue("2027-06-12", "2027-06-13", enabled, policy)).toBeNull();
  });

  it("une feuille désactivée par l'organisation ne part pas", () => {
    expect(roadmapStageDue("2027-06-12", "2027-05-13", { month: false, week: true }, policy)).toBeNull();
    expect(roadmapStageDue("2027-06-12", "2027-06-05", { month: true, week: false }, policy)).toBeNull();
  });

  it("au passage à l'heure d'hiver, J-7 tombe le bon jour dans le fuseau de l'évènement", () => {
    // Évènement le 6 novembre 2027 à Paris ; J-7 = 30 octobre. Le 31 octobre 2027 à 1 h 30 UTC,
    // il est 2 h 30 du matin à Paris (heure d'hiver ce jour-là) : on est le 31, J-7 est passée.
    expect(roadmapStageDue("2027-11-06", "2027-10-30", enabled, policy)).toBe("j7");
    expect(roadmapStageDue("2027-11-06", "2027-10-29", enabled, policy)).toBe("j30");
  });
});

describe("PAR-05 (D8) — Alerte sans confirmation de la feuille de J-7", () => {
  const sentAt = new Date("2027-06-05T08:00:00Z");

  it("apparaît trois jours après l'envoi de J-7 sans confirmation", () => {
    expect(roadmapAlertDue({ stage: "j7", sentAt, confirmedAt: null }, new Date("2027-06-08T08:00:00Z"), 3)).toBe(true);
  });

  it("pas avant, pas après une confirmation, jamais pour J-30", () => {
    expect(roadmapAlertDue({ stage: "j7", sentAt, confirmedAt: null }, new Date("2027-06-08T07:59:00Z"), 3)).toBe(false);
    expect(roadmapAlertDue({ stage: "j7", sentAt, confirmedAt: new Date("2027-06-06T10:00:00Z") }, new Date("2027-06-09T08:00:00Z"), 3)).toBe(false);
    expect(roadmapAlertDue({ stage: "j30", sentAt, confirmedAt: null }, new Date("2027-06-20T08:00:00Z"), 3)).toBe(false);
  });
});

describe("PAR-05 (D6) — Le choix du client s'annule pendant 7 jours", () => {
  const engagedAt = new Date("2027-03-01T10:00:00Z");

  it("annulable jusqu'au septième jour, puis plus", () => {
    expect(canUndoEngagement({ engagedAt, undoneAt: null }, new Date("2027-03-08T09:59:00Z"), policy)).toBe(true);
    expect(canUndoEngagement({ engagedAt, undoneAt: null }, new Date("2027-03-08T10:00:00Z"), policy)).toBe(false);
  });

  it("un engagement déjà annulé ou absent ne s'annule pas", () => {
    expect(canUndoEngagement({ engagedAt, undoneAt: new Date("2027-03-02T10:00:00Z") }, new Date("2027-03-03T10:00:00Z"), policy)).toBe(false);
    expect(canUndoEngagement({ engagedAt: null, undoneAt: null }, new Date("2027-03-03T10:00:00Z"), policy)).toBe(false);
  });
});

describe("BUD-05 — Totaux d'un scénario, au centime", () => {
  it("additionne les montants connus, compte les devis sans montant « à préciser »", () => {
    expect(scenarioTotals([{ amountCents: 245_050 }, { amountCents: 1 }, { amountCents: null }, { amountCents: 0 }])).toEqual({ totalCents: 245_051, pendingCount: 1 });
  });

  it("un poste sans prestataire choisi ne compte pas", () => {
    expect(scenarioTotals([])).toEqual({ totalCents: 0, pendingCount: 0 });
  });

  it("le comparatif se trie par montant, les devis sans montant à la fin", () => {
    const rows = [{ quoteAmountCents: null, vendorName: "B" }, { quoteAmountCents: 300_000, vendorName: "C" }, { quoteAmountCents: 120_000, vendorName: "A" }];
    expect([...rows].sort(compareByAmount).map((row) => row.vendorName)).toEqual(["A", "C", "B"]);
  });
});

describe("PRE-04 (D3) — Un seul lien, ce qu'il montre dépend du statut", () => {
  it("consulté, devis reçu : la consultation", () => {
    expect(vendorLinkStage({ status: "contacted", briefId: "b" })).toBe("consultation");
    expect(vendorLinkStage({ status: "quote_received", briefId: "b" })).toBe("consultation");
    expect(vendorLinkStage({ status: "shortlisted", briefId: "b" })).toBe("consultation");
  });

  it("retenu, contrat signé, soldé : l'espace complet, avec ou sans brief", () => {
    expect(vendorLinkStage({ status: "retained", briefId: "b" })).toBe("retained");
    expect(vendorLinkStage({ status: "contract_signed", briefId: null })).toBe("retained");
    expect(vendorLinkStage({ status: "paid_off", briefId: null })).toBe("retained");
  });

  it("écarté : « un autre choix a été fait » et rien d'autre", () => {
    expect(vendorLinkStage({ status: "dismissed", briefId: "b" })).toBe("declined");
  });

  it("sans brief et pas retenu : rien à montrer", () => {
    expect(vendorLinkStage({ status: "contacted", briefId: null })).toBe("none");
  });

  it("le prestataire change d'avis tant que la planner n'a pas tranché", () => {
    expect(vendorCanAnswer({ status: "contacted", dismissalReason: null, briefId: "b" }, false)).toBe(true);
    expect(vendorCanAnswer({ status: "dismissed", dismissalReason: "unavailable", briefId: "b" }, false)).toBe(true);
    expect(vendorCanAnswer({ status: "dismissed", dismissalReason: "other_chosen", briefId: "b" }, false)).toBe(false);
    expect(vendorCanAnswer({ status: "quote_received", dismissalReason: null, briefId: "b" }, true)).toBe(false);
    expect(vendorCanAnswer({ status: "retained", dismissalReason: null, briefId: "b" }, true)).toBe(false);
  });
});

describe("PAR-05 (D2, D8) — Heures d'envoi", () => {
  it("les envois partent entre 9 h et 19 h à Paris, été comme hiver", () => {
    expect(isVendorSendingHour(new Date("2027-07-01T07:00:00Z"), policy)).toBe(true); // 9 h en été
    expect(isVendorSendingHour(new Date("2027-07-01T06:59:00Z"), policy)).toBe(false);
    expect(isVendorSendingHour(new Date("2027-01-15T07:30:00Z"), policy)).toBe(false); // 8 h 30 en hiver
    expect(isVendorSendingHour(new Date("2027-01-15T17:59:00Z"), policy)).toBe(true); // 18 h 59
    expect(isVendorSendingHour(new Date("2027-01-15T18:00:00Z"), policy)).toBe(false); // 19 h
  });
});
