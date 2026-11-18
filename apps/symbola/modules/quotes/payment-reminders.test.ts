// Lot 43 (FAC-09, FAC-15 ; D1, D7) — relances d'impayés et relance avant expiration, horloge simulée :
// veille, jour même, rattrapage après une panne, changement d'heure.
import { describe, expect, it } from "vitest";
import { dueInvoiceReminder, expiryReminderDue, isProposalExpired, penaltySentence, reminderSendWindow } from "./payment-reminders";

describe("FAC-09 — Relances d'une échéance impayée (J+3, J+10, J+20)", () => {
  const offsets = [3, 10, 20];

  it("rien avant J+3 ; la veille non, le jour même oui", () => {
    expect(dueInvoiceReminder({ dueDate: "2027-01-10", offsets, sentRanks: [], today: "2027-01-12" })).toBeNull();
    expect(dueInvoiceReminder({ dueDate: "2027-01-10", offsets, sentRanks: [], today: "2027-01-13" })).toEqual({ rank: 1, dueOn: "2027-01-13" });
  });

  it("une seule fois par rang : la relance 1 envoyée, rien jusqu'à J+10", () => {
    expect(dueInvoiceReminder({ dueDate: "2027-01-10", offsets, sentRanks: [1], today: "2027-01-19" })).toBeNull();
    expect(dueInvoiceReminder({ dueDate: "2027-01-10", offsets, sentRanks: [1], today: "2027-01-20" })).toEqual({ rank: 2, dueOn: "2027-01-20" });
    expect(dueInvoiceReminder({ dueDate: "2027-01-10", offsets, sentRanks: [1, 2, 3], today: "2027-03-01" })).toBeNull();
  });

  it("après une panne, seule la plus récente des relances manquées part (pas trois e-mails d'un coup)", () => {
    expect(dueInvoiceReminder({ dueDate: "2027-01-10", offsets, sentRanks: [], today: "2027-02-05" })).toEqual({ rank: 3, dueOn: "2027-01-30" });
    expect(dueInvoiceReminder({ dueDate: "2027-01-10", offsets, sentRanks: [], today: "2027-01-22" })).toEqual({ rank: 2, dueOn: "2027-01-20" });
  });

  it("les jours se comptent en jours calendaires de Paris, au passage à l'heure d'été comme ailleurs", () => {
    expect(dueInvoiceReminder({ dueDate: "2027-03-25", offsets, sentRanks: [], today: "2027-03-28" })).toEqual({ rank: 1, dueOn: "2027-03-28" });
  });

  it("les relances partent dans les heures d'envoi (9 h à 19 h à Paris), aussi le jour du changement d'heure", () => {
    expect(reminderSendWindow(new Date("2027-01-13T07:59:00Z"))).toBe(false);
    expect(reminderSendWindow(new Date("2027-01-13T08:00:00Z"))).toBe(true);
    expect(reminderSendWindow(new Date("2027-03-28T07:30:00Z"))).toBe(true);
    expect(reminderSendWindow(new Date("2027-03-28T17:00:00Z"))).toBe(false);
  });
});

describe("FAC-09 — Pénalités de retard dans la relance (D7, AV-7)", () => {
  const words = { noPenalty: "Merci de régulariser.", consumerClause: "Pénalité au taux annuel de {taux}.", professional: "Pénalités au taux BCE + 10, indemnité de 40 €." };

  it("client professionnel : les pénalités du lot 41", () => {
    expect(penaltySentence({ clientKind: "professional", consumerRateBasisPoints: 500, locale: "fr" }, words)).toBe(words.professional);
  });

  it("client particulier : seulement si le contrat prévoit une clause, au taux de la clause", () => {
    expect(penaltySentence({ clientKind: "individual", consumerRateBasisPoints: null, locale: "fr" }, words)).toBe("Merci de régulariser.");
    expect(penaltySentence({ clientKind: "individual", consumerRateBasisPoints: 350, locale: "fr" }, words)).toMatch(/^Pénalité au taux annuel de 3,5\s%\.$/);
    expect(penaltySentence({ clientKind: "non_professional", consumerRateBasisPoints: 1000, locale: "en" }, words)).toBe("Pénalité au taux annuel de 10%.");
  });
});

describe("FAC-15 — Validité d'un devis et relance avant expiration (D1)", () => {
  const sent = { status: "sent" as const, validUntil: "2027-01-12", remindedAt: null, daysBefore: 3, signatureStarted: false };

  it("relance à J-3, une seule fois : la veille de J-3 non, J-3 oui, déjà relancé non", () => {
    expect(expiryReminderDue(sent, "2027-01-08")).toBe(false);
    expect(expiryReminderDue(sent, "2027-01-09")).toBe(true);
    expect(expiryReminderDue(sent, "2027-01-12")).toBe(true);
    expect(expiryReminderDue({ ...sent, remindedAt: new Date("2027-01-09T09:00:00Z") }, "2027-01-10")).toBe(false);
  });

  it("pas de relance après une signature, un refus, ni une fois expiré", () => {
    expect(expiryReminderDue({ ...sent, status: "signed" }, "2027-01-10")).toBe(false);
    expect(expiryReminderDue({ ...sent, status: "declined" }, "2027-01-10")).toBe(false);
    expect(expiryReminderDue({ ...sent, signatureStarted: true }, "2027-01-10")).toBe(false);
    expect(expiryReminderDue(sent, "2027-01-13")).toBe(false);
  });

  it("une version est expirée le lendemain de sa date de validité, pas le jour même", () => {
    expect(isProposalExpired("2027-01-12", "2027-01-12")).toBe(false);
    expect(isProposalExpired("2027-01-12", "2027-01-13")).toBe(true);
    expect(isProposalExpired(null, "2030-01-01")).toBe(false);
  });
});
