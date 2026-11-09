import { describe, expect, it } from "vitest";
import { clientDueOn, inactiveAccountDueOn, isExpired, prospectDueOn, requestProofDueOn } from "./retention";

const months = { prospectRetentionMonths: 36, clientRetentionMonths: 36, inactiveAccountMonths: 24 };

describe("RGPD-05 — Règles de conservation (dates simulées)", () => {
  it("prospect sans suite : 3 ans après la dernière activité ; échu le jour même, pas la veille", () => {
    const due = prospectDueOn(["2023-01-10", "2023-11-02", null], months);
    expect(due).toBe("2026-11-02");
    expect(isExpired("2026-11-01", due!)).toBe(false);
    expect(isExpired("2026-11-02", due!)).toBe(true);
  });

  it("client : 3 ans après la plus tardive entre la date de l'événement et le dernier encaissement", () => {
    expect(clientDueOn({ eventDate: "2023-06-12", lastPaymentOn: "2023-09-30" }, months)).toBe("2026-09-30");
    expect(clientDueOn({ eventDate: "2023-06-12", lastPaymentOn: null }, months)).toBe("2026-06-12");
    // Relation non terminée (ni date ni paiement) : rien n'est échu.
    expect(clientDueOn({ eventDate: null, lastPaymentOn: null }, months)).toBeNull();
    // 29 février : ramené au dernier jour du mois.
    expect(clientDueOn({ eventDate: "2024-02-29", lastPaymentOn: null }, { ...months, clientRetentionMonths: 12 })).toBe("2025-02-28");
  });

  it("compte d'un marié : 2 ans sans connexion, ou depuis sa création s'il ne s'est jamais connecté", () => {
    expect(inactiveAccountDueOn({ lastLoginOn: "2024-11-03", createdOn: "2024-01-01" }, months)).toBe("2026-11-03");
    expect(inactiveAccountDueOn({ lastLoginOn: null, createdOn: "2024-11-02" }, months)).toBe("2026-11-02");
    expect(isExpired("2026-11-02", "2026-11-03")).toBe(false);
  });
});

describe("RGPD-09 — Fin de la preuve d'une demande d'exercice de droits close (dates simulées)", () => {
  const proof = { requestProofRetentionMonths: 60 };

  it("Étant donné une demande close, alors sa preuve est échue 5 ans après la clôture : le jour même, pas la veille", () => {
    const due = requestProofDueOn({ closedOn: "2026-11-09" }, proof);
    expect(due).toBe("2031-11-09");
    expect(isExpired("2031-11-08", due!)).toBe(false);
    expect(isExpired("2031-11-09", due!)).toBe(true);
  });

  it("Étant donné une demande en cours (pas de date de clôture), alors rien n'est échu", () => {
    expect(requestProofDueOn({ closedOn: null }, proof)).toBeNull();
  });

  it("la durée suit le réglage de l'organisation ; un 29 février est ramené au dernier jour du mois", () => {
    expect(requestProofDueOn({ closedOn: "2026-11-09" }, { requestProofRetentionMonths: 36 })).toBe("2029-11-09");
    expect(requestProofDueOn({ closedOn: "2028-02-29" }, proof)).toBe("2033-02-28");
  });
});
